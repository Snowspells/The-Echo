const express = require('express');
const { requireAuth, requireStaff, STAFF_LEVELS } = require('../middleware/auth');
const xss = require('xss');

const router = express.Router();

// Chat page
router.get('/', requireAuth, (req, res) => {
    const user = req.session.user;
    res.render('chat', {
        user,
        title: 'Global Chat'
    });
});

// Staff: Mute a user
router.post('/mute', requireStaff(STAFF_LEVELS.MODERATOR), (req, res) => {
    const { userId, reason, duration } = req.body;
    const user = req.resolvedUser || req.session.user;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    let expiresAt = null;
    if (duration && parseInt(duration) > 0) {
        expiresAt = new Date(Date.now() + parseInt(duration) * 60 * 1000).toISOString();
    }

    const sanitizedReason = reason ? xss(reason.substring(0, 200)) : null;
    req.db.setChatMute(userId, user.id, user.username, sanitizedReason, expiresAt);

    // Notify muted user via WebSocket
    const webServer = req.webServer;
    if (webServer) {
        for (const [, client] of webServer.wsClients) {
            if (client.user.id === userId && client.ws.readyState === 1) {
                client.ws.send(JSON.stringify({
                    type: 'muted',
                    reason: sanitizedReason || 'No reason given',
                    expires_at: expiresAt
                }));
            }
        }
        // Broadcast system message
        webServer.broadcastToWebClients({
            type: 'system',
            content: `${userId} has been muted by ${user.username}.`,
            timestamp: new Date().toISOString()
        });
    }

    res.json({ success: true });
});

// Staff: Unmute a user
router.post('/unmute', requireStaff(STAFF_LEVELS.MODERATOR), (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    req.db.removeChatMute(userId);

    const webServer = req.webServer;
    if (webServer) {
        for (const [, client] of webServer.wsClients) {
            if (client.user.id === userId && client.ws.readyState === 1) {
                client.ws.send(JSON.stringify({ type: 'unmuted' }));
            }
        }
    }

    res.json({ success: true });
});

// Staff: Delete a message
router.post('/delete-message', requireStaff(STAFF_LEVELS.MODERATOR), (req, res) => {
    const { messageId } = req.body;

    if (!messageId) {
        return res.status(400).json({ error: 'Missing messageId' });
    }

    req.db.deleteBridgeMessage(parseInt(messageId));

    // Notify all WS clients to remove the message
    const webServer = req.webServer;
    if (webServer) {
        webServer.broadcastToWebClients({
            type: 'delete_message',
            messageId: parseInt(messageId)
        });
    }

    res.json({ success: true });
});

// Staff: Get active mutes
router.get('/mutes', requireStaff(STAFF_LEVELS.SUPPORT), (req, res) => {
    const mutes = req.db.getAllChatMutes();
    res.json({ mutes });
});

module.exports = router;

const express = require('express');
const { info, warn, error } = require('../../utils/Console');

const router = express.Router();

// Legacy HTTP inbound relay for custom game servers that can POST. Path of
// Titans servers cannot host HTTP; their in-game chat is ingested from the
// server's Discord webhook by src/events/ChatBridge/onGameChat.js instead.
router.post('/bridge/incoming', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!process.env.BRIDGE_API_KEY || apiKey !== process.env.BRIDGE_API_KEY) {
        warn('Chat bridge: unauthorized API request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { playerName, message, playerId } = req.body;

    if (!playerName || !message) {
        return res.status(400).json({ error: 'Missing playerName or message' });
    }

    const client = req.discordClient;
    const bridgeChannelId = process.env.BRIDGE_CHANNEL_ID;

    if (!bridgeChannelId) {
        return res.status(500).json({ error: 'Bridge channel not configured' });
    }

    const channel = client.channels.cache.get(bridgeChannelId);
    if (!channel) {
        return res.status(500).json({ error: 'Bridge channel not found' });
    }

    const content = `**[Global] ${playerName}:** ${message}`;
    channel.send(content)
        .then(() => {
            req.db.logBridgeMessage('game', playerName, playerId || null, message);
            info(`Bridge (Game -> Discord): ${playerName}: ${message}`);

            // Relay to web clients
            if (req.webServer) {
                req.webServer.relayMessageToWeb('game', playerName, playerId || null, message);
            }

            res.json({ success: true });
        })
        .catch((err) => {
            error('Bridge send error:', err);
            res.status(500).json({ error: 'Failed to send message' });
        });
});

router.get('/bridge/messages', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!process.env.BRIDGE_API_KEY || apiKey !== process.env.BRIDGE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const messages = req.db.getRecentBridgeMessages(limit);
    res.json({ messages });
});

router.get('/bridge/health', (req, res) => {
    const client = req.discordClient;
    res.json({
        status: 'ok',
        bot_online: client.isReady(),
        bridge_channel_configured: !!process.env.BRIDGE_CHANNEL_ID,
        uptime: client.uptime
    });
});

router.get('/user/:discordId', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!process.env.BRIDGE_API_KEY || apiKey !== process.env.BRIDGE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.db.getUserByDiscordId(req.params.discordId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        discord_id: user.DID,
        agid: user.agid,
        marks: user.marks,
        inventory: JSON.parse(user.inventory || '[]'),
        created_at: user.created_at
    });
});

module.exports = router;

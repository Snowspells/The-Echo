const express = require('express');
const { requireStaff, STAFF_LEVELS } = require('../middleware/auth');
const { info } = require('../../utils/Console');
const DatabaseManager = require('../../utils/Database');
const { normalizeAgid, isValidAgid } = require('../../utils/pot');

const router = express.Router();

router.get('/', requireStaff(STAFF_LEVELS.SUPPORT), (req, res) => {
    const users = req.db.getAllUsers();
    const recentMessages = req.db.getRecentBridgeMessages(25);
    const botGuilds = req.discordClient.guilds.cache.size;
    const staffRoles = req.db.getAllStaffRoles();
    const recentTickets = req.db.getAllTickets(10);
    const ticketStats = process.env.STAFF_GUILD_ID
        ? req.db.getTicketStats(process.env.STAFF_GUILD_ID)
        : { total: 0, open: 0, closed: 0 };

    const rcon = req.discordClient.rcon;
    const rconEnabled = !!rcon?.isEnabled();

    res.render('admin', {
        user: req.session.user,
        users,
        recentMessages,
        staffRoles,
        recentTickets,
        ticketStats,
        rconEnabled,
        rconStatus: rconEnabled ? rcon.status() : [],
        onlinePlayers: req.db.getOnlineGamePlayers(),
        recentGamePlayers: req.db.getRecentGamePlayers(25),
        staffLabels: DatabaseManager.STAFF_LABELS,
        stats: {
            totalUsers: users.length,
            botGuilds,
            botUptime: formatUptime(req.discordClient.uptime)
        }
    });
});

// ---- Path of Titans RCON actions ---------------------------------------

function rconOrError(req, res) {
    const rcon = req.discordClient.rcon;
    if (!rcon?.isEnabled()) {
        res.status(400).json({ error: 'RCON is not configured.' });
        return null;
    }
    return rcon;
}

// Live player list (Support+)
router.get('/rcon/players', requireStaff(STAFF_LEVELS.SUPPORT), async (req, res) => {
    const rcon = rconOrError(req, res);
    if (!rcon) return;
    try {
        const response = await rcon.getPlayers(req.query.server || null);
        res.json({ players: response });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Announce (Moderator+)
router.post('/rcon/announce', requireStaff(STAFF_LEVELS.MODERATOR), async (req, res) => {
    const rcon = rconOrError(req, res);
    if (!rcon) return;
    const { message, server } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Missing message' });
    try {
        await rcon.announce(message.trim().slice(0, 300), server || null);
        info(`Web RCON announce by ${req.session.user.username}: ${message}`);
        res.json({ success: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Kick (Moderator+)
router.post('/rcon/kick', requireStaff(STAFF_LEVELS.MODERATOR), async (req, res) => {
    const rcon = rconOrError(req, res);
    if (!rcon) return;
    const { agid, reason, server } = req.body;
    if (!isValidAgid(agid)) return res.status(400).json({ error: 'Invalid AGID' });
    try {
        await rcon.kick(normalizeAgid(agid), (reason || '').slice(0, 200), server || null);
        info(`Web RCON kick by ${req.session.user.username}: ${agid}`);
        res.json({ success: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// Ban (Administrator)
router.post('/rcon/ban', requireStaff(STAFF_LEVELS.ADMINISTRATOR), async (req, res) => {
    const rcon = rconOrError(req, res);
    if (!rcon) return;
    const { agid, hours, reason, server } = req.body;
    if (!isValidAgid(agid)) return res.status(400).json({ error: 'Invalid AGID' });
    try {
        await rcon.ban(normalizeAgid(agid), parseInt(hours, 10) || 0, (reason || '').slice(0, 200), server || null);
        info(`Web RCON ban by ${req.session.user.username}: ${agid}`);
        res.json({ success: true });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

router.post('/users/:id/update', requireStaff(STAFF_LEVELS.MODERATOR), (req, res) => {
    const discordId = req.params.id;
    const { agid, marks } = req.body;

    const updateData = {};
    if (agid !== undefined) updateData.agid = agid;
    if (marks !== undefined) updateData.marks = parseInt(marks, 10);

    if (Object.keys(updateData).length > 0) {
        req.db.updateUser(discordId, updateData);
        info(`Admin ${req.session.user.username} (${req.session.user.staffLabel}) updated user ${discordId}: ${JSON.stringify(updateData)}`);
    }

    res.redirect('/admin');
});

router.post('/users/:id/delete', requireStaff(STAFF_LEVELS.ADMINISTRATOR), (req, res) => {
    const discordId = req.params.id;
    req.db.deleteUser(discordId);
    info(`Admin ${req.session.user.username} (${req.session.user.staffLabel}) deleted user ${discordId}`);
    res.redirect('/admin');
});

function formatUptime(ms) {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
}

module.exports = router;

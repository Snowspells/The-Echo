const express = require('express');
const { requireStaff } = require('../middleware/auth');
const { info } = require('../../utils/Console');

const router = express.Router();

router.get('/', requireStaff, (req, res) => {
    const users = req.db.getAllUsers();
    const recentMessages = req.db.getRecentBridgeMessages(25);
    const botGuilds = req.discordClient.guilds.cache.size;

    res.render('admin', {
        user: req.session.user,
        users,
        recentMessages,
        stats: {
            totalUsers: users.length,
            botGuilds,
            botUptime: formatUptime(req.discordClient.uptime)
        }
    });
});

router.post('/users/:id/update', requireStaff, (req, res) => {
    const discordId = req.params.id;
    const { agid, marks } = req.body;

    const updateData = {};
    if (agid !== undefined) updateData.agid = agid;
    if (marks !== undefined) updateData.marks = parseInt(marks, 10);

    if (Object.keys(updateData).length > 0) {
        req.db.updateUser(discordId, updateData);
        info(`Admin ${req.session.user.username} updated user ${discordId}: ${JSON.stringify(updateData)}`);
    }

    res.redirect('/admin');
});

router.post('/users/:id/delete', requireStaff, (req, res) => {
    const discordId = req.params.id;
    req.db.deleteUser(discordId);
    info(`Admin ${req.session.user.username} deleted user ${discordId}`);
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

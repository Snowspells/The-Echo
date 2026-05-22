const config = require('../../config');
const DatabaseManager = require('../../utils/Database');

const STAFF_LEVELS = DatabaseManager.STAFF_LEVELS;

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
}

function requireStaff(minLevel = STAFF_LEVELS.SUPPORT) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        const staffLevel = req.session.user.staffLevel || 0;
        const isOwner = req.session.user.id === config.users.ownerId;

        if (!isOwner && staffLevel < minLevel) {
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                message: 'You do not have the required staff access level.',
                user: req.session.user
            });
        }

        next();
    };
}

module.exports = { requireAuth, requireStaff, STAFF_LEVELS };

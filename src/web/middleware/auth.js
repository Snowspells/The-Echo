const config = require('../../config');

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
}

function requireStaff(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    const staffIds = [
        config.users.ownerId,
        ...(config.users.developers || [])
    ];

    if (!staffIds.includes(req.session.user.id)) {
        return res.status(403).render('error', {
            title: '403 - Forbidden',
            message: 'You do not have staff access.',
            user: req.session.user
        });
    }

    next();
}

module.exports = { requireAuth, requireStaff };

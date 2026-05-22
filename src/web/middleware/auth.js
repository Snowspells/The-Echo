const config = require('../../config');
const DatabaseManager = require('../../utils/Database');

const STAFF_LEVELS = DatabaseManager.STAFF_LEVELS;

function resolveUser(req) {
    // Check session-based auth first
    if (req.session.user) {
        return req.session.user;
    }

    // Check token-based auth (for standalone client)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const tokenData = req.db.getClientToken(token);
        if (tokenData && new Date(tokenData.expires_at) >= new Date()) {
            const isOwner = tokenData.discord_id === config.users.ownerId;
            return {
                id: tokenData.discord_id,
                username: tokenData.username,
                discriminator: tokenData.discriminator,
                avatar: tokenData.avatar,
                isStaff: !!tokenData.is_staff || isOwner,
                staffLevel: isOwner ? STAFF_LEVELS.OWNER : (tokenData.staff_level || 0),
                staffLabel: isOwner ? 'Owner' : (tokenData.staff_label || null),
                roles: tokenData.roles
            };
        }
    }

    return null;
}

function requireAuth(req, res, next) {
    const user = resolveUser(req);
    if (!user) {
        // If it's an API/JSON request, return 401 instead of redirect
        if (req.headers.authorization || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        return res.redirect('/auth/login');
    }
    // Attach resolved user so downstream handlers can use it
    req.resolvedUser = user;
    next();
}

function requireStaff(minLevel = STAFF_LEVELS.SUPPORT) {
    return (req, res, next) => {
        const user = resolveUser(req);
        if (!user) {
            if (req.headers.authorization || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            return res.redirect('/auth/login');
        }

        const staffLevel = user.staffLevel || 0;
        const isOwner = user.id === config.users.ownerId;

        if (!isOwner && staffLevel < minLevel) {
            if (req.headers.authorization || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                message: 'You do not have the required staff access level.',
                user: user
            });
        }

        req.resolvedUser = user;
        next();
    };
}

module.exports = { requireAuth, requireStaff, STAFF_LEVELS };

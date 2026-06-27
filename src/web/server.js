const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const http = require('http');
const xss = require('xss');
const { info, error, success, debug } = require('../utils/Console');
const DatabaseManager = require('../utils/Database');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const ticketRoutes = require('./routes/tickets');
const chatRoutes = require('./routes/chat');
const clientAuthRoutes = require('./routes/client-auth');

class WebServer {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.port = process.env.WEB_PORT || 3000;
        this.httpServer = http.createServer(this.app);
        this.wsClients = new Map();
        this.wsConnectionsByIp = new Map();   // IP -> count (DDoS: max connections per IP)
        this.wsConnectionAttempts = new Map(); // IP -> { count, resetAt } (DDoS: connection rate)
        this.chatCooldowns = new Map();        // userId -> last message timestamp (slowmode)
        this.CHAT_COOLDOWN_MS = 1500;          // 1.5s between messages per user
        this.MAX_WS_PER_IP = 5;                // Max simultaneous WS connections per IP
        this.MAX_WS_CONNECTS_PER_MIN = 20;     // Max WS connection attempts per IP per minute
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));

        // Security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'https://cdn.discordapp.com', 'data:'],
                    connectSrc: ["'self'", 'ws:', 'wss:'],
                    frameSrc: ["'self'"],
                    fontSrc: ["'self'"],
                }
            }
        }));

        // Rate limiting
        const generalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 200,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Too many requests, please try again later.' }
        });

        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 15,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Too many login attempts, please try again later.' }
        });

        const apiLimiter = rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 60,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'API rate limit exceeded.' }
        });

        this.app.use(generalLimiter);

        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.sessionMiddleware = session({
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            name: 'echo.sid',
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        });
        this.app.use(this.sessionMiddleware);

        // Apply stricter rate limits to sensitive routes
        this.app.use('/auth', authLimiter);
        this.app.use('/api', apiLimiter);

        this.app.use((req, res, next) => {
            req.discordClient = this.client;
            req.db = this.client.database;
            req.webServer = this;
            res.locals.user = req.session.user || null;
            next();
        });
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.render('index', {
                botName: 'The Echo',
                user: req.session.user || null
            });
        });

        this.app.use('/auth', authRoutes);
        this.app.use('/dashboard', dashboardRoutes);
        this.app.use('/admin', adminRoutes);
        this.app.use('/api', apiRoutes);
        this.app.use('/tickets', ticketRoutes);
        this.app.use('/chat', chatRoutes);
        this.app.use('/auth/client', clientAuthRoutes);

        this.app.use((req, res) => {
            res.status(404).render('error', {
                title: '404 - Not Found',
                message: 'The page you are looking for does not exist.',
                user: req.session.user || null
            });
        });

        this.app.use((err, req, res, _next) => {
            error('Web server error:', err);
            res.status(500).render('error', {
                title: '500 - Server Error',
                message: 'An internal server error occurred.',
                user: req.session.user || null
            });
        });
    }

    getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    }

    checkWsConnectionRate(ip) {
        const now = Date.now();
        const record = this.wsConnectionAttempts.get(ip);
        if (!record || now > record.resetAt) {
            this.wsConnectionAttempts.set(ip, { count: 1, resetAt: now + 60000 });
            return true;
        }
        record.count++;
        return record.count <= this.MAX_WS_CONNECTS_PER_MIN;
    }

    setupWebSocket() {
        this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws/chat' });

        this.wss.on('connection', (ws, req) => {
            const ip = this.getClientIp(req);

            // DDoS: Check connection rate per IP
            if (!this.checkWsConnectionRate(ip)) {
                debug(`WebSocket rate limited (connection flood): ${ip}`);
                ws.close(4008, 'Too many connection attempts');
                return;
            }

            // DDoS: Check max simultaneous connections per IP
            const currentCount = this.wsConnectionsByIp.get(ip) || 0;
            if (currentCount >= this.MAX_WS_PER_IP) {
                debug(`WebSocket max connections reached for IP: ${ip}`);
                ws.close(4008, 'Too many connections');
                return;
            }
            this.wsConnectionsByIp.set(ip, currentCount + 1);

            // Try token-based auth first (for standalone client)
            const url = new URL(req.url, 'http://localhost');
            const bearerToken = url.searchParams.get('token');

            if (bearerToken) {
                this.authenticateWithToken(ws, req, ip, bearerToken);
            } else {
                // Fall back to session-based auth (for web browser)
                const mockRes = { on() {}, end() {}, writeHead() {} };
                this.sessionMiddleware(req, mockRes, () => {
                    const user = req.session?.user;
                    if (!user) {
                        this.wsConnectionsByIp.set(ip, (this.wsConnectionsByIp.get(ip) || 1) - 1);
                        ws.close(4001, 'Not authenticated');
                        return;
                    }

                    // Look up AGID and role color for session users
                    const linkedUser = this.client.database.getUserByDiscordId(user.id);
                    const roleColor = this.client.database.getRoleColor(user.staffLevel || 0);
                    const isOwner = this.isOwnerUser(user.id);
                    const effectiveLevel = isOwner ? DatabaseManager.STAFF_LEVELS.OWNER : (user.staffLevel || 0);
                    const effectiveLabel = isOwner ? 'Owner' : (user.staffLabel || 'Member');
                    const effectiveColor = isOwner ? (this.client.database.getRoleColor(DatabaseManager.STAFF_LEVELS.OWNER)?.color || '#f0883e') : (roleColor?.color || '#8b949e');

                    const enrichedUser = {
                        ...user,
                        staffLevel: effectiveLevel,
                        staffLabel: effectiveLabel,
                        agid: linkedUser?.agid || null,
                        roleColor: effectiveColor,
                        source: 'web'
                    };

                    this.registerClient(ws, enrichedUser, ip, 'web');
                });
            }
        });
    }

    handleChatMessage(clientId, msg) {
        const client = this.wsClients.get(clientId);
        if (!client) return;

        const { user } = client;

        // Check if user is muted
        const muteInfo = this.client.database.getChatMute(user.id);
        if (muteInfo) {
            const now = new Date();
            const expiresAt = muteInfo.expires_at ? new Date(muteInfo.expires_at) : null;
            if (!expiresAt || now < expiresAt) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: `You are muted${expiresAt ? ` until ${expiresAt.toLocaleString()}` : ''}: ${muteInfo.reason || 'No reason given'}`
                }));
                return;
            }
            // Mute expired, remove it
            this.client.database.removeChatMute(user.id);
        }

        if (msg.type === 'message') {
            const content = xss(msg.content?.trim() || '');
            if (!content || content.length === 0 || content.length > 500) return;

            // Slowmode: enforce per-user cooldown
            const now = Date.now();
            const lastMsg = this.chatCooldowns.get(user.id) || 0;
            if (now - lastMsg < this.CHAT_COOLDOWN_MS) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: 'You are sending messages too fast. Please slow down.'
                }));
                return;
            }
            this.chatCooldowns.set(user.id, now);

            // Log to database
            this.client.database.logBridgeMessage('web', user.username, user.id, content);

            // Broadcast to all WS clients
            const broadcastMsg = {
                type: 'message',
                source: client.source || 'web',
                author_name: user.username,
                author_id: user.id,
                content: content,
                timestamp: new Date().toISOString(),
                isStaff: user.isStaff,
                staffLevel: user.staffLevel || 0,
                staffLabel: user.staffLabel || 'Member',
                roleColor: user.roleColor || '#8b949e',
                agid: user.agid || null
            };
            this.broadcastToWebClients(broadcastMsg);

            // Relay to Discord bridge channel
            this.relayToDiscord(user.username, content);

            // Relay to game
            this.relayToGame(user.username, content, user.id);
        }
    }

    authenticateWithToken(ws, req, ip, token) {
        const tokenData = this.client.database.getClientToken(token);
        if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
            this.wsConnectionsByIp.set(ip, (this.wsConnectionsByIp.get(ip) || 1) - 1);
            ws.close(4001, 'Invalid or expired token');
            return;
        }

        const linkedUser = this.client.database.getUserByDiscordId(tokenData.discord_id);
        const isOwner = this.isOwnerUser(tokenData.discord_id);
        const effectiveLevel = isOwner ? DatabaseManager.STAFF_LEVELS.OWNER : (tokenData.staff_level || 0);
        const effectiveLabel = isOwner ? 'Owner' : (tokenData.staff_label || 'Member');
        const roleColor = this.client.database.getRoleColor(effectiveLevel);

        const user = {
            id: tokenData.discord_id,
            username: tokenData.username,
            discriminator: tokenData.discriminator,
            avatar: tokenData.avatar,
            isStaff: !!tokenData.is_staff || isOwner,
            staffLevel: effectiveLevel,
            staffLabel: effectiveLabel,
            roles: tokenData.roles,
            agid: linkedUser?.agid || null,
            roleColor: roleColor?.color || '#8b949e',
            source: 'client'
        };

        this.registerClient(ws, user, ip, 'client');
    }

    isOwnerUser(userId) {
        try {
            const config = require('../config');
            return userId === config.users.ownerId;
        } catch {
            return false;
        }
    }

    registerClient(ws, user, ip, source) {
        const clientId = crypto.randomBytes(8).toString('hex');
        this.wsClients.set(clientId, { ws, user, ip, source });
        debug(`WebSocket connected: ${user.username} (${clientId}) from ${ip} via ${source}`);

        // Send recent messages with role colors
        const recentMessages = this.client.database.getRecentBridgeMessages(50);
        ws.send(JSON.stringify({ type: 'history', messages: recentMessages }));

        // Send role colors config
        const roleColors = this.client.database.getAllRoleColors();
        ws.send(JSON.stringify({ type: 'role_colors', colors: roleColors }));

        // Send online users list and count
        this.broadcastOnlineUsers();

        ws.on('message', (data) => {
            if (data.length > 10240) {
                debug(`WebSocket oversized message from ${user.username}`);
                return;
            }
            try {
                const msg = JSON.parse(data.toString());
                this.handleChatMessage(clientId, msg);
            } catch (err) {
                debug(`WebSocket parse error: ${err.message}`);
            }
        });

        ws.on('close', () => {
            this.wsClients.delete(clientId);
            const ipCount = this.wsConnectionsByIp.get(ip) || 1;
            this.wsConnectionsByIp.set(ip, Math.max(0, ipCount - 1));
            debug(`WebSocket disconnected: ${user.username} (${clientId})`);
            this.broadcastOnlineUsers();
        });

        ws.on('error', (err) => {
            debug(`WebSocket error: ${err.message}`);
            this.wsClients.delete(clientId);
            const ipCount = this.wsConnectionsByIp.get(ip) || 1;
            this.wsConnectionsByIp.set(ip, Math.max(0, ipCount - 1));
        });
    }

    broadcastToWebClients(msg) {
        const data = JSON.stringify(msg);
        for (const [, client] of this.wsClients) {
            if (client.ws.readyState === 1) {
                client.ws.send(data);
            }
        }
    }

    broadcastOnlineCount() {
        const count = this.wsClients.size;
        const data = JSON.stringify({ type: 'online_count', count });
        for (const [, client] of this.wsClients) {
            if (client.ws.readyState === 1) {
                client.ws.send(data);
            }
        }
    }

    broadcastOnlineUsers() {
        const users = [];
        const seenIds = new Set();
        for (const [, client] of this.wsClients) {
            if (!seenIds.has(client.user.id)) {
                seenIds.add(client.user.id);
                users.push({
                    id: client.user.id,
                    username: client.user.username,
                    avatar: client.user.avatar,
                    staffLevel: client.user.staffLevel || 0,
                    staffLabel: client.user.staffLabel || 'Member',
                    roleColor: client.user.roleColor || '#8b949e',
                    agid: client.user.agid || null,
                    source: client.source || 'web'
                });
            }
        }

        // Sort by staff level descending (Owner first, Member last)
        users.sort((a, b) => b.staffLevel - a.staffLevel);

        const data = JSON.stringify({ type: 'online_users', users, count: users.length });
        for (const [, client] of this.wsClients) {
            if (client.ws.readyState === 1) {
                client.ws.send(data);
            }
        }
        // Also broadcast count for legacy web clients
        this.broadcastOnlineCount();
    }

    relayToDiscord(username, content) {
        const bridgeChannelId = process.env.BRIDGE_CHANNEL_ID;
        if (!bridgeChannelId) return;

        try {
            const channel = this.client.channels?.cache?.get(bridgeChannelId);
            if (channel) {
                channel.send(`**[Web] ${username}:** ${content}`);
            }
        } catch (err) {
            debug(`Discord relay error: ${err.message}`);
        }
    }

    relayToGame(username, content, discordId) {
        const gameWebhookUrl = process.env.GAME_WEBHOOK_URL;
        if (!gameWebhookUrl) return;

        fetch(gameWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.BRIDGE_API_KEY || ''
            },
            body: JSON.stringify({
                playerName: username,
                message: content,
                discordId: discordId,
                source: 'web'
            })
        }).catch(err => debug(`Game relay error: ${err.message}`));
    }

    // Called by the Discord bridge event to relay messages to web clients
    relayMessageToWeb(source, authorName, authorId, content) {
        const msg = {
            type: 'message',
            source,
            author_name: authorName,
            author_id: authorId,
            content,
            timestamp: new Date().toISOString()
        };
        this.broadcastToWebClients(msg);
    }

    start() {
        return new Promise((resolve) => {
            this.httpServer.listen(this.port, () => {
                success(`Web dashboard running at http://localhost:${this.port}`);
                this.startTokenCleanup();
                resolve();
            });
        });
    }

    startTokenCleanup() {
        const runCleanup = () => {
            try {
                this.client.database.deleteExpiredClientTokens();
                this.client.database.deleteExpiredOAuthStates();
                this.client.database.deleteExpiredAuthCodes();
            } catch (err) {
                debug(`Token cleanup error: ${err.message}`);
            }
        };
        runCleanup();
        // Purge expired client tokens, OAuth states, and one-time codes every 10 minutes
        this.cleanupInterval = setInterval(runCleanup, 10 * 60 * 1000);
    }

    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.httpServer) {
            this.wss?.close();
            this.httpServer.close();
            info('Web server stopped.');
        }
    }
}

module.exports = WebServer;

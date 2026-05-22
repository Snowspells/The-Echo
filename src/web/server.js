const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { info, error, success } = require('../utils/Console');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const ticketRoutes = require('./routes/tickets');

class WebServer {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.port = process.env.WEB_PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use(session({
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            }
        }));

        this.app.use((req, res, next) => {
            req.discordClient = this.client;
            req.db = this.client.database;
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

    start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                success(`Web dashboard running at http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            info('Web server stopped.');
        }
    }
}

module.exports = WebServer;

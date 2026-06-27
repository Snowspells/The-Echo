require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');
const WebServer = require('./web/server');
const RconManager = require('./utils/RconManager');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

const web = new WebServer(client);
client.webServer = web;
web.start();

// Path of Titans RCON integration (no-op when no RCON server is configured)
const rcon = new RconManager();
client.rcon = rcon;
rcon.connectAll();

const { error, info } = require('./utils/Console');
process.on('unhandledRejection', (err) => error('Unhandled Rejection', err));
process.on('uncaughtException', (err) => error('Uncaught Exception', err));

const shutdown = async () => {
    info('Shutting down...');
    try { await rcon.disconnectAll(); } catch { /* ignore */ }
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
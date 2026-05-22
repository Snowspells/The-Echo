require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');
const WebServer = require('./web/server');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

const web = new WebServer(client);
client.webServer = web;
web.start();

const { error } = require('./utils/Console');
process.on('unhandledRejection', (err) => error('Unhandled Rejection', err));
process.on('uncaughtException', (err) => error('Uncaught Exception', err));
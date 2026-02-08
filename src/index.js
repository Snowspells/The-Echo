require('dotenv').config();
const fs = require('fs');
const DiscordBot = require('./client/DiscordBot');

fs.writeFileSync('./terminal.log', '', 'utf-8');
const client = new DiscordBot();

module.exports = client;

client.connect();

const { error } = require('./utils/Console');
process.on('unhandledRejection', (err) => error('Unhandled Rejection', err));
process.on('uncaughtException', (err) => error('Uncaught Exception', err));
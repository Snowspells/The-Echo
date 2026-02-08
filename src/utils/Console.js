require('colors');
const fs = require('fs');

const LEVELS = { error: 0, warn: 1, success: 2, info: 3, debug: 4 };
let CURRENT_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

if (!fs.existsSync('./terminal.log')) {
    fs.writeFileSync('./terminal.log', '', 'utf-8');
}

const shouldLog = (levelName) => {
    const level = LEVELS[levelName] ?? LEVELS.info;
    return level <= CURRENT_LEVEL;
};

const writeLog = (label, colorFn, message) => {
    const time = new Date().toLocaleTimeString();
    let fileContent = fs.readFileSync('./terminal.log', 'utf-8');

    console.log(`[${time}]`.gray, colorFn(label), message);
    fileContent += [`[${time}]`.gray, label, message].join(' ') + '\n';

    fs.writeFileSync('./terminal.log', fileContent, 'utf-8');
};

const info = (...message) => {
    if (!shouldLog('info')) return;
    writeLog('[Info]'.blue, (s) => s.blue, message.join(' '));
};

const success = (...message) => {
    if (!shouldLog('success')) return;
    writeLog('[OK]'.green, (s) => s.green, message.join(' '));
};

const warn = (...message) => {
    if (!shouldLog('warn')) return;
    writeLog('[Warning]'.yellow, (s) => s.yellow, message.join(' '));
};

const error = (...message) => {
    if (!shouldLog('error')) return;

    // If the last argument is an Error, include its stack trace
    const last = message[message.length - 1];
    let output = message.join(' ');

    if (last instanceof Error) {
        output = message.slice(0, -1).join(' ');
        output += (output.length ? ' ' : '') + last.stack;
    }

    writeLog('[Error]'.red, (s) => s.red, output);
};

const debug = (...message) => {
    if (!shouldLog('debug')) return;
    writeLog('[Debug]'.magenta, (s) => s.magenta, message.join(' '));
};

const setLogLevel = (levelName) => {
    const l = (levelName || '').toLowerCase();
    if (LEVELS[l] === undefined) return false;
    CURRENT_LEVEL = LEVELS[l];
    return true;
};

module.exports = { info, success, error, warn, debug, setLogLevel };
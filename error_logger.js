const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'error_log.txt');

function logError(err) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${err.stack || err}\n\n`;
    
    console.error(message);
    
    try {
        fs.appendFileSync(logFile, message);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
}

// Global exception handlers
process.on('uncaughtException', (err) => {
    logError('UNCAUGHT EXCEPTION: ' + err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logError('UNHANDLED REJECTION: ' + reason);
});

module.exports = { logError };

const cron = require('node-cron');
const { triggerBlast } = require('./bot');
const db = require('./database');

let scheduledTask = null;

function initScheduler() {
    const blastTime = process.env.BLAST_TIME || '09:00';
    const [hour, minute] = blastTime.split(':');
    const timezone = process.env.BLAST_TIMEZONE || 'Asia/Kuala_Lumpur';

    // Schedule daily blast
    const cronExpression = `${minute} ${hour} * * *`;

    scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`⏰ Scheduled blast triggered at ${new Date().toISOString()}`);

        try {
            const result = await triggerBlast();
            console.log('📨 Blast result:', result);
        } catch (err) {
            console.error('❌ Scheduled blast error:', err);
        }
    }, {
        timezone: timezone,
        scheduled: true
    });

    console.log(`⏰ Daily blast scheduled at ${blastTime} (${timezone})`);
    return scheduledTask;
}

function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        console.log('⏰ Scheduler stopped');
    }
}

function reschedule(newTime) {
    stopScheduler();
    process.env.BLAST_TIME = newTime;
    initScheduler();
}

module.exports = { initScheduler, stopScheduler, reschedule };

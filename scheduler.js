const cron = require('node-cron');
const { triggerBlast, sendAutoReminder } = require('./bot');
const db = require('./database');

let scheduledTask = null;
let reminderTask = null;

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

    // Schedule automatic reminder at 3:00 PM (15:00) Malaysia time
    reminderTask = cron.schedule('0 15 * * *', async () => {
        console.log(`🔔 Auto reminder triggered at ${new Date().toISOString()}`);

        try {
            const result = await sendAutoReminder();
            console.log('📨 Auto reminder result:', result);
        } catch (err) {
            console.error('❌ Auto reminder error:', err);
        }
    }, {
        timezone: timezone,
        scheduled: true
    });

    console.log(`⏰ Daily blast scheduled at ${blastTime} (${timezone})`);
    console.log(`🔔 Auto reminder scheduled at 15:00 (3:00 PM ${timezone})`);
    return { scheduledTask, reminderTask };
}

function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        console.log('⏰ Scheduler stopped');
    }
    if (reminderTask) {
        reminderTask.stop();
        console.log('🔔 Reminder scheduler stopped');
    }
}

function reschedule(newTime) {
    stopScheduler();
    process.env.BLAST_TIME = newTime;
    initScheduler();
}

function checkAndSendMissedReminder() {
    const now = new Date();
    const malaysiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
    const malaysiaHour = malaysiaTime.getHours();
    
    // Check if we're after 3:00 PM (15:00) and we might have missed the reminder
    if (malaysiaHour >= 15) {
        console.log('🔔 Checking for missed reminder after server restart...');
        sendAutoReminder().catch(err => {
            console.error('❌ Missed reminder error:', err);
        });
    }
}

module.exports = { initScheduler, stopScheduler, reschedule, checkAndSendMissedReminder };

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
const MAX_MEMBERS = parseInt(process.env.MAX_MEMBERS) || 100;

let bot = null;
let botInfo = null;
let groupChatId = null;

// ─── Member Management Functions ───────────────────────────────────────
async function handleMemberJoin(chatId, member) {
    const memberId = String(member.id);

    // Enforce member limit
    const activeCount = db.getActiveCount();
    const existing = db.getMember(memberId);

    if (!existing && activeCount >= MAX_MEMBERS) {
        try {
            await bot.banChatMember(chatId, member.id);
            await bot.unbanChatMember(chatId, member.id);
            console.log(`⛔ Member limit reached, removed: ${member.first_name} (${memberId})`);
        } catch (err) {
            console.error('Error removing excess member:', err);
        }
        return;
    }

    if (existing) {
        // Reactivate if they left and rejoined
        db.reactivateMember(memberId);
        console.log(`🔄 Member rejoined: ${member.first_name} (${memberId})`);
    } else {
        // New member
        db.addMember(memberId, member.username, member.first_name, member.last_name);
        console.log(`✅ New member joined: ${member.first_name} (${memberId})`);
    }
}

// ─── Initialize Bot ──────────────────────────────────────────────
function initBot() {
    bot = new TelegramBot(BOT_TOKEN, {
        polling: {
            params: {
                allowed_updates: [
                    'message',
                    'chat_member',
                    'my_chat_member',
                    'callback_query'
                ]
            }
        }
    });

    // Load saved group chat ID (Database first, then .env fallback)
    groupChatId = db.getSetting('group_chat_id');
    if (!groupChatId && process.env.GROUP_CHAT_ID) {
        groupChatId = process.env.GROUP_CHAT_ID;
        db.setSetting('group_chat_id', groupChatId);
        console.log(`📡 Group ID initialized from .env: ${groupChatId}`);
    }

    // Global Message Logger
    bot.on('message', (msg) => {
        const userId = msg.from.id;
        const text = msg.text || '[No Text]';
        console.log(`📩 [LOG] Incoming message from ${msg.from.first_name} (${userId}): "${text}"`);
    });

    // Set default (regular user) commands globally
    bot.setMyCommands([
        { command: 'start', description: 'Main menu' },
        { command: 'myid', description: 'Check my ID' }
    ]).then(() => console.log('✅ Global default commands set')).catch(e => console.error('❌ Error setting global commands:', e.message));

    // Fetch bot info for deep linking
    bot.getMe().then(info => {
        botInfo = info;
        console.log(`🤖 Bot identity: @${info.username}`);
    });

    // ── /start command ──
    bot.onText(/\/start ?(.*)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);
        const payload = match[1];
        const adminStatus = isAdmin(userId);

        console.log(`📡 /start Handler Triggered | Payload: "${payload}" | From: ${msg.from.first_name} [${userId}]`);

        try {
            if (msg.chat.type === 'private') {
                // Update bot commands menu for this specific user based on their role
                // We await this to ensure the menu is refreshed before user can interact further
                await setBotCommands(userId);

                // Handle Deep Linking payload (e.g., L_123)
                if (payload && payload.startsWith('L_')) {
                    const linkId = parseInt(payload.split('_')[1]);
                    const link = db.getLinkById(linkId);

                    if (link) {
                        db.addClick(linkId, userId, 'Telegram App');
                        const safeTitle = escapeHtml(link.title || 'TikTok Product');
                        bot.sendMessage(chatId,
                            `✅ <b>Link Verified!</b>\n\n` +
                            `📌 <b>Item:</b> ${safeTitle}\n\n` +
                            `Click the button below to open in TikTok:`,
                            {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [[
                                        { text: '🚀 Open TikTok', url: link.url }
                                    ]]
                                }
                            }
                        );
                    } else {
                        bot.sendMessage(chatId,
                            `❌ <b>Link Expired or Not Found</b>\n\n` +
                            `This TikTok link has been removed by the admin or has expired.`,
                            { parse_mode: 'HTML' }
                        );
                    }
                    return;
                }

                // Regular /start
                let welcomeMsg = `🎯 <b>Cut Price Blast System</b>\n\n`;

                if (adminStatus) {
                    welcomeMsg += `Welcome Admin! This bot manages TikTok cut price links.\n\n` +
                        `👑 <b>Admin Commands:</b>\n` +
                        `/submit &lt;url&gt; &lt;name&gt; - Submit/Update your TikTok link with a name\n` +
                        `/setup - Create the private group\n` +
                        `/mygroup - Check/Auto-detect Group ID\n` +
                        `/cleargroup - Clear old Group ID\n` +
                        `/instructions - Post group instructions\n` +
                        `/blast - Manually trigger link blast\n` +
                        `/remindpending - Remind members with pending links to update\n` +
                        `/stats - View today's click stats\n` +
                        `/nonclickers - View who hasn't clicked today\n\n` +
                        `📋 <b>User Commands:</b>\n` +
                        `/mylink - Check your current link status\n` +
                        `/cutqueue - Request to cut queue (Paid Fast-Track)\n` +
                        `/myid - Get your Telegram ID (Send to Admin: @Kharrley)`;
                } else {
                    welcomeMsg += `Welcome to the TikTok Cut Price system!\n\n` +
                        `📝 <b>How to join:</b>\n` +
                        `1. Send <code>/submit &lt;url&gt; &lt;name&gt;</code> here to add your link.\n` +
                        `2. Wait for the daily blast to see your link in the group.\n\n` +
                        `📋 <b>Commands:</b>\n` +
                        `/submit &lt;url&gt; &lt;name&gt; - Submit/Update your TikTok link with a name\n` +
                        `/mylink - Check your current link status\n` +
                        `/cutqueue - Request to cut queue (Paid Fast-Track)\n` +
                        `/myid - Get your Telegram ID\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `⚠️ <b>Note:</b>\n` +
                        `Links expire every 24 hours. Ensure you click other members' links in the group to stay active!`;
                }

                bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML' });
            }
        } catch (err) {
            console.error('❌ Error in /start handler:', err);
            bot.sendMessage(chatId, `⚠️ <b>Bot Error:</b> something went wrong processing your request.\n\n${err.message}`, { parse_mode: 'HTML' });
        }
    });

    // ── /myid command ──
    bot.onText(/\/myid/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🆔 Your Telegram ID: \`${msg.from.id}\``,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /mylink command ──
    bot.onText(/\/mylink/, (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        const link = db.getUserPendingLink(userId);

        if (!link) {
            bot.sendMessage(chatId,
                `❓ *You have no pending link.*\n\n` +
                `Use \`/submit <url> <name>\` to add one for the next blast.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const position = db.getLinkQueuePosition(link.id);
        const blastTime = process.env.BLAST_TIME || '17:01';

        // Calculate expected blast date (Malaysia Time UTC+8)
        const now = new Date();
        const myt = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const mytDateStr = myt.toISOString().split('T')[0];
        const blastToday = new Date(`${mytDateStr}T${blastTime}:00.000Z`);

        let expectedDate;
        if (myt.getTime() >= blastToday.getTime()) {
            // Already passed today's blast
            const tomorrow = new Date(myt.getTime() + (24 * 60 * 60 * 1000));
            expectedDate = tomorrow.toISOString().split('T')[0];
        } else {
            expectedDate = mytDateStr;
        }

        const blastStatus = position <= 10 ? "✅ *Targeted for next blast*" : "⚠️ *Queue long (May wait until tomorrow)*";

        bot.sendMessage(chatId,
            `📝 *Your Current Link:*\n\n` +
            `🏷️ Name: *${link.title || 'No name'}*\n` +
            `🔗 \`${link.url}\`\n` +
            `📊 Status: *Pending*\n` +
            `🔢 Queue Position: *#${position}*\n` +
            `🚀 Expected Blast: *${expectedDate} at ${blastTime}*\n\n` +
            `${blastStatus}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `⏰ Submitted: ${link.created_at_myt}\n\n` +
            `_You can update this anytime by sending \`/submit <new_url> <new_name>\`_\n` +
            `_To move your link to #1 instantly, send \`/cutqueue\`_`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /cutqueue command ──
    bot.onText(/\/cutqueue/, (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        const link = db.getUserPendingLink(userId);

        if (!link) {
            bot.sendMessage(chatId,
                `❓ *You have no pending link to promote.*\n\n` +
                `Submit a link first using \`/submit <url> <name>\`.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (link.priority_approved) {
            bot.sendMessage(chatId, `✅ *Your link is already at the top of the queue!*`);
            return;
        }

        if (link.is_priority_requested) {
            bot.sendMessage(chatId,
                `⏳ *Priority Request Pending Approval*\n\n` +
                `Please wait for the administrator to confirm your payment.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        db.requestPriority(link.id);

        bot.sendMessage(chatId,
            `🚀 *Cut Queue Request Received!*\n\n` +
            `To move your link to #1 position, please follow these steps:\n\n` +
            `1️⃣ Pay RM5 to the administrator (TNG/Bank Transfer)\n` +
            `2️⃣ Send the payment receipt to Admin at: <b>@Kharrley</b>\n` +
            `3️⃣ Once confirmed, your link will move to the TOP immediately.\n\n` +
            `Status: *Waiting for Payment Confirmation*`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /submit command (All Users) ──
    bot.onText(/\/submit (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);
        const input = match[1].trim();

        // Split by first space to get URL and Name
        const parts = input.split(/\s+/);
        const url = parts[0];
        const customName = parts.slice(1).join(' ');

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            bot.sendMessage(chatId, 
                '❌ *Invalid URL Format*\n\n' +
                '📝 *Correct Format Examples:*\n' +
                '• `https://www.tiktok.com/@username`\n' +
                '• `https://vm.tiktok.com/abc123`\n' +
                '• `https://tiktok.com/@username`\n\n' +
                '💡 *Usage:* `/submit <url> <name>`\n\n' +
                '📱 *How to get your TikTok URL:*\n' +
                '1. Open TikTok app → Profile → Share Profile\n' +
                '2. Copy the link and paste here',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Check if name is provided
        if (!customName || customName.trim().length === 0) {
            bot.sendMessage(chatId,
                '❌ *Name Required*\n\n' +
                'Please include your name after the URL.\n\n' +
                '💡 *Usage:* `/submit <url> <name>`\n\n' +
                '📝 *Examples:*\n' +
                '• `/submit https://tiktok.com/@johndoe John Doe`\n' +
                '• `/submit https://vm.tiktok.com/abc123 Sarah`\n' +
                '• `/submit https://www.tiktok.com/@username Your Name`',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const submitterName = msg.from.username || msg.from.first_name || 'User';
        const submitterId = String(msg.from.id);
        const finalTitle = customName || submitterName;

        // Check time restriction (3 PM - 11:59 PM only for regular users, admins can submit 24 hours)
        if (!isAdmin(userId)) {
            const currentTime = new Date();
            const malaysiaTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
            const malaysiaHour = malaysiaTime.getHours();
            
            // Allow submissions from 15:00 (3 PM) to 23:59 (11:59 PM) for regular users
            if (malaysiaHour < 15 || malaysiaHour > 23) { // Before 3 PM (15:00) or after 11:59 PM (23:59)
                bot.sendMessage(chatId,
                    `⏰ *Submission Time Restricted*\n\n` +
                    `📅 *Allowed Hours:* 3:00 PM - 11:59 PM (Malaysia Time)\n` +
                    `🕐 *Current Time:* ${malaysiaTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })}\n\n` +
                    `Please submit your link during the allowed hours.\n\n` +
                    `📝 *Come back between 3:00 PM and 11:59 PM to submit your cut price link!*`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }
        }

        try {
            // Check if user already has a pending link
            const existing = db.getUserPendingLink(submitterId);

            if (existing) {
                // Update existing link
                db.updateLink(existing.id, url, finalTitle, existing.description, existing.priority_order);
                bot.sendMessage(chatId,
                    `🔄 *Link Updated!*\n\n` +
                    `🏷️ Name: *${finalTitle}*\n` +
                    `🔗 ${url}\n\n` +
                    `Your current pending link has been refreshed.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                // Add new link
                db.addLink(url, finalTitle, '', null, submitterName, submitterId);
                bot.sendMessage(chatId,
                    `✅ *Link Submitted!*\n\n` +
                    `🏷️ Name: *${finalTitle}*\n` +
                    `🔗 ${url}\n` +
                    `📊 Status: Pending\n\n` +
                    `Your link is now in the queue for the next daily blast. 🚀`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (err) {
            bot.sendMessage(chatId, `❌ Error: ${err.message}`);
        }
    });

    // ── /setup command (Admin only) ──
    bot.onText(/\/setup/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        if (groupChatId) {
            bot.sendMessage(chatId,
                `⚠️ Group already set up!\n\nGroup Chat ID: \`${groupChatId}\``,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        bot.sendMessage(chatId,
            `📋 *Group Setup Instructions*\n\n` +
            `Since Telegram bots cannot create groups directly, please:\n\n` +
            `1️⃣ Create a new Telegram Group manually\n` +
            `2️⃣ Name it "Cut Price TikTok 🎯"\n` +
            `3️⃣ Add this bot to the group\n` +
            `4️⃣ Make the bot an *Admin* with all permissions\n` +
            `5️⃣ Send /register in the group\n\n` +
            `The bot will then configure the group automatically.`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /mygroup command (Admin only) ──
    bot.onText(/\/mygroup/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        let detectedGroupId = null;
        let autoSet = false;

        // If command is sent in a group (not private chat), auto-detect and set the group ID
        if (msg.chat.type !== 'private') {
            detectedGroupId = String(chatId);
            groupChatId = detectedGroupId;
            db.setSetting('group_chat_id', groupChatId);
            autoSet = true;
            console.log(`⚙️ Admin ${userId} auto-detected and set Group ID to: ${groupChatId}`);
        }

        const currentId = getGroupChatId();
        const inviteLink = db.getSetting('invite_link') || 'Not generated yet (run /register in group)';

        let message = `📋 *Current Group Configuration*\n\n` +
                     `🆔 Group ID: \`${currentId || 'Not set'}\`\n` +
                     `🔗 Invite Link: ${inviteLink}`;

        if (autoSet) {
            message += `\n\n✅ *Auto-detected this group and set it as the blast target!*`;
        } else if (msg.chat.type === 'private') {
            message += `\n\n💡 *Tip:* Send this command in your Telegram group to auto-detect the Group ID!` +
                      `\n\n🔄 *To clear old group ID:* Send /cleargroup`;
        }

        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // ── /cleargroup command (Admin only) ──
    bot.onText(/\/cleargroup/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        try {
            db.setSetting('group_chat_id', '');
            groupChatId = null;
            bot.sendMessage(chatId, '✅ *Group ID Cleared!*\n\nOld group ID has been removed. Send /mygroup in your new group to auto-detect the new ID.', { parse_mode: 'Markdown' });
            console.log(`⚙️ Admin ${userId} cleared group ID`);
        } catch (err) {
            bot.sendMessage(chatId, `❌ Error clearing group ID: ${err.message}`);
        }
    });

    // ── /instructions command (Admin only) ──
    bot.onText(/\/instructions/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        const instructionsMessage = `🎯 Welcome to Cut Price TikTok Group!\n\n` +
            `📝 How to Submit Your TikTok Link:\n\n` +
            `⏰ Member Submission Hours:\n` +
            `3:00 PM - 11:59 PM (Malaysia Time)\n\n` +
            `Step 1: Submit to Bot\n` +
            `Send to @EzCutPriceBot: /submit <your_tiktok_url> <your_name>\n\n` +
            `Example:\n` +
            `/submit https://www.tiktok.com/@johndoe John Doe\n\n` +
            `📋 Available Commands:\n` +
            `/start - Main menu\n` +
            `/submit <url> <name> - Submit your TikTok link\n` +
            `/mylink - Check your link status\n` +
            `/cutqueue - Jump to front (paid)\n` +
            `/myid - Get your Telegram ID\n\n` +
            `⚠️ Important Rules:\n` +
            `✅ Submit your REAL TikTok cut price URL\n` +
            `✅ Use your REAL name\n` +
            `✅ Click other members' links daily\n` +
            `✅ Be respectful and professional\n\n` +
            `❌ Don't submit fake URLs\n` +
            `❌ Don't use inappropriate names\n` +
            `❌ Don't spam multiple links\n\n` +
            `🕐 Daily Schedule:\n` +
            `• Blast Time: 10:00 PM (Malaysia Time)\n` +
            `• Link Duration: 24 hours\n` +
            `• Activity Check: Daily\n\n` +
            `🆘 Need Help?\n` +
            `Contact Admin: @Kharrley\n` +
            `Send your User ID (use /myid to get it)\n\n` +
            `🎯 Tips for Success:\n` +
            `1. Click 2+ links every day to stay active\n` +
            `2. Make sure you stay up to date on group updates\n` +
            `3. Follow the instructions given\n\n` +
            `🚀 Ready? Submit your first link now!\n\n` +
            `Remember: Active participation = Better results for everyone! 🎯`;

        try {
            if (msg.chat.type === 'private') {
                bot.sendMessage(chatId, '📍 Note: Send this command in your group to post instructions there.');
            } else {
                await bot.sendMessage(chatId, instructionsMessage);
                bot.sendMessage(chatId, '✅ Instructions posted successfully! You can pin this message for all members to see.');
            }
        } catch (err) {
            bot.sendMessage(chatId, `❌ Error posting instructions: ${err.message}`);
        }
    });

    // ── /remindpending command (Admin only) ──
    bot.onText(/\/remindpending/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        try {
            // Get all pending links
            const pendingLinks = db.getPendingLinks();
            
            if (pendingLinks.length === 0) {
                bot.sendMessage(chatId, '✅ No pending links found. All links have been blasted!');
                return;
            }

            // Create reminder message
            let reminderMessage = `🔔 REMINDER: Update Your Pending Links\n\n` +
                `Found ${pendingLinks.length} members with pending links that need to be updated:\n\n`;

            // List members with pending links
            pendingLinks.forEach((link, index) => {
                const createdDate = new Date(link.created_at);
                const daysPending = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
                
                reminderMessage += `${index + 1}. ${link.title}\n` +
                    `📅 Submitted: ${daysPending} day(s) ago\n` +
                    `🔗 Link: ${link.url}\n\n`;
            });

            reminderMessage += `📝 How to Update Your Link:\n` +
                `Send to @EzCutPriceBot:\n` +
                `/submit <new_tiktok_url> <your_name>\n\n` +
                `⏰ Submission Hours: 3:00 PM - 11:59 PM (Malaysia Time)\n\n` +
                `❗ Important: Please update your links to ensure they remain active and relevant!`;

            // Send reminder to group
            if (msg.chat.type === 'private') {
                bot.sendMessage(chatId, '📍 Note: Send this command in your group to remind members there.');
            } else {
                await bot.sendMessage(chatId, reminderMessage);
                bot.sendMessage(chatId, `✅ Reminder sent to ${pendingLinks.length} members with pending links!`);
            }

            // Also send individual reminders to each member
            for (const link of pendingLinks) {
                try {
                    const individualReminder = `🔔 Personal Reminder: Update Your Link\n\n` +
                        `Hi ${link.title}! You have a pending link that needs to be updated:\n\n` +
                        `🔗 Current Link: ${link.url}\n` +
                        `📅 Submitted: ${new Date(link.created_at).toLocaleDateString()}\n\n` +
                        `📝 To Update: Send me: /submit <new_tiktok_url> <your_name>\n\n` +
                        `⏰ Submission Hours: 3:00 PM - 11:59 PM (Malaysia Time)\n\n` +
                        `❗ Please update your link to keep it active in the system!`;

                    await bot.sendMessage(link.submitted_by_id, individualReminder);
                    console.log(`📩 Sent reminder to ${link.title} (${link.submitted_by_id})`);
                } catch (err) {
                    console.error(`❌ Failed to send reminder to ${link.submitted_by_id}:`, err.message);
                }
            }

            console.log(`🔔 Admin ${userId} sent reminders to ${pendingLinks.length} members with pending links`);

        } catch (err) {
            bot.sendMessage(chatId, `❌ Error sending reminders: ${err.message}`);
        }
    });

    // ── /register command (in group, Admin only) ──
    bot.onText(/\/register/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (msg.chat.type === 'private') {
            bot.sendMessage(chatId, '❌ Use this command in the group you want to register.');
            return;
        }

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        try {
            // Save group chat ID
            groupChatId = String(chatId);
            db.setSetting('group_chat_id', groupChatId);

            // Set group permissions - only admin can send messages
            await bot.setChatPermissions(chatId, {
                can_send_messages: false,
                can_send_audios: false,
                can_send_documents: false,
                can_send_photos: false,
                can_send_videos: false,
                can_send_video_notes: false,
                can_send_voice_notes: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false,
                can_manage_topics: false
            });

            // Generate invite link
            const inviteLink = await bot.createChatInviteLink(chatId, {
                name: 'Cut Price Group Invite',
                creates_join_request: false
            });

            db.setSetting('invite_link', inviteLink.invite_link);

            await bot.sendMessage(chatId,
                `✅ *Group Registered & Configured!*\n\n` +
                `🔒 Only admin can send messages\n` +
                `👥 Member limit: ${MAX_MEMBERS}\n` +
                `🔗 Invite link generated\n\n` +
                `Group is ready for TikTok cut price blasting! 🚀`,
                { parse_mode: 'Markdown' }
            );

            // Send invite link to admin privately
            bot.sendMessage(userId,
                `🔗 *Group Invite Link:*\n\n${inviteLink.invite_link}\n\n` +
                `Share this link with members (max ${MAX_MEMBERS}).`,
                { parse_mode: 'Markdown' }
            );

        } catch (err) {
            bot.sendMessage(chatId, `❌ Setup error: ${err.message}\n\nMake sure the bot is an admin with all permissions.`);
        }
    });


    // ── Callback Query Handler ──
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = String(query.from.id);
        const data = query.data;

        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Admin only.', show_alert: true });
            return;
        }

        // Acknowledge if any other buttons exist (e.g. from tracker)
        bot.answerCallbackQuery(query.id);
    });

    // ── /blast command (Admin only) ──
    bot.onText(/\/blast/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        const result = await triggerBlast();
        bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
    });

    // ── /stats command (Admin only) ──
    bot.onText(/\/stats/, (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        const todayBlasts = db.getTodayBlasts();
        const todayClicks = db.getTodayClicks();
        const members = db.getAllMembers();
        const nonClickers = db.getNonClickersToday();
        const clickedToday = db.getMemberClickedToday();

        let statsMsg = `📊 *Today's Stats*\n\n`;
        statsMsg += `📨 Links Blasted: ${todayBlasts.length}\n`;
        statsMsg += `👆 Total Clicks: ${todayClicks.length}\n`;
        statsMsg += `👥 Active Members: ${members.length}\n`;
        statsMsg += `✅ Members Who Clicked: ${clickedToday.length}\n`;
        statsMsg += `❌ Non-Clickers: ${nonClickers.length}\n`;

        if (nonClickers.length > 0) {
            statsMsg += `\n*Non-Clickers:*\n`;
            nonClickers.slice(0, 20).forEach((m, i) => {
                const name = m.username ? `@${m.username}` : m.first_name;
                statsMsg += `${i + 1}. ${name}\n`;
            });
            if (nonClickers.length > 20) {
                statsMsg += `... and ${nonClickers.length - 20} more`;
            }
        }

        bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    });

    // ── /nonclickers command (Admin only) ──
    bot.onText(/\/nonclickers/, (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        const nonClickers = db.getNonClickersToday();

        if (nonClickers.length === 0) {
            bot.sendMessage(chatId, '✅ All members have clicked today! 🎉');
            return;
        }

        let message = `❌ *Non-Clickers Today (${nonClickers.length}):*\n\n`;
        nonClickers.forEach((m, i) => {
            const name = m.username ? `@${m.username}` : m.first_name;
            message += `${i + 1}. ${name} (ID: ${m.telegram_id})\n`;
        });

        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // ── Member join tracking (new_chat_members) ──
    bot.on('new_chat_members', (msg) => {
        const chatId = String(msg.chat.id);
        const targetGroup = groupChatId || db.getSetting('group_chat_id');
        if (chatId !== targetGroup) return;

        msg.new_chat_members.forEach(async (member) => {
            if (member.is_bot) return;
            await handleMemberJoin(chatId, member);
        });
    });

    // ── Member join tracking (chat_member updates — fires for invite-link joins) ──
    bot.on('chat_member', async (update) => {
        const chatId = String(update.chat.id);
        const targetGroup = groupChatId || db.getSetting('group_chat_id');
        if (chatId !== targetGroup) return;

        const newStatus = update.new_chat_member?.status;
        const oldStatus = update.old_chat_member?.status;
        const member = update.new_chat_member?.user;

        if (!member || member.is_bot) return;

        // Member just joined (was not a member before)
        if ((newStatus === 'member' || newStatus === 'administrator') &&
            (oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus)) {
            await handleMemberJoin(chatId, member);
        }

        // Member left or was kicked
        if (newStatus === 'left' || newStatus === 'kicked') {
            db.deactivateMember(String(member.id));
            console.log(`👋 Member left: ${member.first_name} (${member.id})`);
        }
    });

    // ── Member leave tracking ──
    bot.on('left_chat_member', (msg) => {
        const chatId = String(msg.chat.id);
        const targetGroup = groupChatId || db.getSetting('group_chat_id');
        if (chatId !== targetGroup) return;

        const member = msg.left_chat_member;
        if (member.is_bot) return;

        db.deactivateMember(String(member.id));
    });

    console.log('🤖 Telegram Bot started successfully');
    return bot;
}

// ─── Role-based command sets ───
async function setBotCommands(userId) {
    // Telegram API requires chat_id to be an integer for 'chat' scope
    const chatIdInt = parseInt(userId, 10);
    try {
        if (isAdmin(userId)) {
            // Special commands for admins — overrides global defaults only for this user
            await bot.setMyCommands([
                { command: 'start', description: 'Admin Control Center' },
                { command: 'submit', description: 'Submit/Update link (URL Name)' },
                { command: 'mylink', description: 'View my link status' },
                { command: 'cutqueue', description: 'Request to cut queue (Paid)' },
                { command: 'blast', description: 'Trigger link blast' },
                { command: 'stats', description: 'View click stats' },
                { command: 'nonclickers', description: 'View non-clickers today' },
                { command: 'setup', description: 'Configure group instructions' },
                { command: 'mygroup', description: 'Check/Auto-detect Group ID' },
                { command: 'cleargroup', description: 'Clear old Group ID' },
                { command: 'instructions', description: 'Post group instructions' },
                { command: 'remindpending', description: 'Remind pending link updates' },
                { command: 'myid', description: 'Check my ID' }
            ], { scope: { type: 'chat', chat_id: chatIdInt } });
            console.log(`👑 Admin menu set for ${userId}`);
        } else {
            // For regular users, set user-specific commands
            await bot.setMyCommands([
                { command: 'start', description: 'Welcome' },
                { command: 'submit', description: 'Submit/Update link (URL Name)' },
                { command: 'mylink', description: 'View my link status' },
                { command: 'cutqueue', description: 'Request to cut queue (Paid)' },
                { command: 'myid', description: 'Check my ID' }
            ], { scope: { type: 'chat', chat_id: chatIdInt } });
            console.log(`👤 User menu set for ${userId}`);
        }
    } catch (err) {
        console.error('Error setting bot commands:', err.message);
    }
}

// ─── Blast Function ──────────────────────────────────────────────
async function triggerBlast() {
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    const targetGroupId = getGroupChatId();

    if (!targetGroupId) {
        return '❌ No group registered. Use /setup and /register first.';
    }

    // Check connection before blasting
    const isConnected = await checkConnection(targetGroupId);
    if (!isConnected) {
        return '❌ Cannot connect to Telegram Group. Please check if the Group ID is correct and the bot is an admin in that group.';
    }

    const linksPerBlast = parseInt(process.env.LINKS_PER_BLAST) || 10;
    const pendingLinks = db.getPendingLinks(linksPerBlast);

    if (pendingLinks.length === 0) {
        return '❌ No pending links to blast. Add more links!';
    }

    // Get today's date in Malaysia (UTC+8)
    const now = new Date();
    const mytDate = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const today = mytDate.toISOString().split('T')[0];
    const members = db.getAllMembers();

    let message = `🎯 <b>CUT PRICE TIKTOK — Daily Links</b>\n`;
    message += `📅 ${today}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const botUsername = botInfo ? botInfo.username : 'BotUsername';

    for (let i = 0; i < pendingLinks.length; i++) {
        const link = pendingLinks[i];
        const title = escapeHtml(link.title || link.submitter_name || `Link #${i + 1}`);
        // Deep link format: https://t.me/botname?start=L_ID
        const deepLink = `https://t.me/${botUsername}?start=L_${link.id}`;

        message += `${i + 1}. <b>${title}</b>\n`;
        message += `🔗 <a href="${deepLink}">Tap here to open link</a>\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⚠️ <b>Click all links above!</b>\n`;
    message += `📊 Admin will monitor who hasn't clicked.`;

    try {
        // Send the complete message with all links
        const sentMsg = await bot.sendMessage(targetGroupId, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

        // Mark all links as blasted
        for (let i = 0; i < pendingLinks.length; i++) {
            const link = pendingLinks[i];
            db.updateLinkStatus(link.id, 'blasted');
            db.addBlastRecord(today, link.id, String(sentMsg.message_id));
        }

        // Clear all remaining pending links (Fresh Start every day)
        db.expireAllPendingLinks();

        return `✅ <b>Blast Complete!</b>\n\n📨 ${pendingLinks.length} links sent to group.\n📊 Remaining queue auto-expired for tomorrow's fresh start.`;
    } catch (err) {
        console.error('❌ Blast error:', err);
        return `❌ Blast error: ${err.message}`;
    }
}

function isAdmin(userId) {
    const envAdminId = process.env.ADMIN_TELEGRAM_ID;

    // 1. Check .env (highest priority)
    if (envAdminId && envAdminId.trim() !== '') {
        const isEnvAdmin = String(userId) === String(envAdminId).trim();
        if (isEnvAdmin) {
            console.log(`🛡️ Security: User ${userId} verified as ADMIN via .env`);
            return true;
        }
    }

    // 2. Fallback to database
    const savedAdmin = db.getSetting('admin_id');
    const isDbAdmin = String(userId) === String(savedAdmin);

    if (isDbAdmin) {
        console.log(`🛡️ Security: User ${userId} verified as ADMIN via Database`);
    } else {
        console.log(`🛡️ Security: User ${userId} denied admin access`);
    }

    return isDbAdmin;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getBot() {
    return bot;
}

function getGroupChatId() {
    return groupChatId || db.getSetting('group_chat_id');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkConnection(chatId) {
    if (!bot || !chatId) return false;
    try {
        await bot.getChat(chatId);
        return true;
    } catch (err) {
        console.error(`❌ Connection check failed for group ${chatId}:`, err.message);
        return false;
    }
}

async function notifyUser(userId, message) {
    if (!bot) return;
    try {
        await bot.sendMessage(userId, message, { parse_mode: 'HTML' });
        return true;
    } catch (err) {
        console.error(`❌ notification error for user ${userId}:`, err.message);
        return false;
    }
}

// ── Auto Reminder Function ──
async function sendAutoReminder() {
    try {
        // Get all pending links
        const pendingLinks = db.getPendingLinks();
        
        if (pendingLinks.length === 0) {
            console.log('✅ No pending links found for auto reminder.');
            return { success: true, message: 'No pending links found.' };
        }

        // Get group chat ID from settings
        const groupChatId = db.getSetting('group_chat_id');
        
        if (!groupChatId) {
            console.log('❌ No group chat ID found for auto reminder.');
            return { success: false, message: 'No group chat ID configured.' };
        }

        // Create reminder message
        let reminderMessage = `🔔 AUTO REMINDER: Update Your Pending Links\n\n` +
            `⏰ Submission hours are NOW OPEN (3:00 PM - 11:59 PM)\n\n` +
            `Found ${pendingLinks.length} members with pending links that need to be updated:\n\n`;

        // List members with pending links
        pendingLinks.forEach((link, index) => {
            const createdDate = new Date(link.created_at);
            const daysPending = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
            
            reminderMessage += `${index + 1}. ${link.title}\n` +
                `📅 Submitted: ${daysPending} day(s) ago\n` +
                `🔗 Link: ${link.url}\n\n`;
        });

        reminderMessage += `📝 How to Update Your Link:\n` +
            `Send to @EzCutPriceBot:\n` +
            `/submit <new_tiktok_url> <your_name>\n\n` +
            `⏰ Submission Hours: 3:00 PM - 11:59 PM (Malaysia Time)\n\n` +
            `❗ Important: Please update your links to ensure they remain active and relevant!\n\n` +
            `🤖 This is an automated reminder sent at 3:00 PM daily.`;

        // Send reminder to group
        await bot.sendMessage(groupChatId, reminderMessage);
        
        // Also send individual reminders to each member
        let individualRemindersSent = 0;
        for (const link of pendingLinks) {
            try {
                const individualReminder = `🔔 Personal Reminder: Update Your Link\n\n` +
                    `Hi ${link.title}! You have a pending link that needs to be updated:\n\n` +
                    `🔗 Current Link: ${link.url}\n` +
                    `📅 Submitted: ${new Date(link.created_at).toLocaleDateString()}\n\n` +
                    `📝 To Update: Send me: /submit <new_tiktok_url> <your_name>\n\n` +
                    `⏰ Submission Hours: 3:00 PM - 11:59 PM (Malaysia Time)\n\n` +
                    `❗ Please update your link to keep it active in the system!\n\n` +
                    `🤖 This is an automated reminder sent at 3:00 PM daily.`;

                await bot.sendMessage(link.submitted_by_id, individualReminder);
                console.log(`📩 Sent auto reminder to ${link.title} (${link.submitted_by_id})`);
                individualRemindersSent++;
            } catch (err) {
                console.error(`❌ Failed to send auto reminder to ${link.submitted_by_id}:`, err.message);
            }
        }

        console.log(`🔔 Auto reminder sent to group and ${individualRemindersSent}/${pendingLinks.length} members`);
        return { 
            success: true, 
            message: `Auto reminder sent to ${pendingLinks.length} members`,
            groupReminderSent: true,
            individualRemindersSent: individualRemindersSent
        };

    } catch (err) {
        console.error('❌ Error sending auto reminder:', err);
        return { success: false, message: err.message };
    }
}

module.exports = { 
    initBot, 
    getBot, 
    getGroupChatId, 
    triggerBlast, 
    isAdmin, 
    notifyUser, 
    checkConnection, 
    sendAutoReminder 
};

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
const MAX_MEMBERS = parseInt(process.env.MAX_MEMBERS) || 100;

let bot = null;
let botInfo = null;
let groupChatId = null;

// ─── Handle Member Join (new + rejoin) ───────────────────────────────────────
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

    // Load saved group chat ID
    groupChatId = db.getSetting('group_chat_id');

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

        console.log(`📡 /start from ${msg.from.first_name} [${userId}] | Payload: "${payload}" | IsAdmin: ${adminStatus}`);

        if (msg.chat.type === 'private') {
            // Update bot commands menu for this specific user based on their role
            setBotCommands(userId);

            // Handle Deep Linking payload (e.g., L_123)
            if (payload && payload.startsWith('L_')) {
                const linkId = parseInt(payload.split('_')[1]);
                const link = db.getLinkById(linkId);

                if (link) {
                    db.addClick(linkId, userId, 'Telegram App');
                    bot.sendMessage(chatId,
                        `✅ *Link Verified!*\n\n` +
                        `📌 *Item:* ${link.title || 'TikTok Product'}\n\n` +
                        `Click the button below to open in TikTok:`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '🚀 Open TikTok', url: link.url }
                                ]]
                            }
                        }
                    );
                } else {
                    bot.sendMessage(chatId,
                        `❌ *Link Expired or Not Found*\n\n` +
                        `This TikTok link has been removed by the admin or has expired.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                return;
            }

            // Regular /start
            let welcomeMsg = `🎯 *Cut Price Blast System*\n\n`;

            if (adminStatus) {
                welcomeMsg += `Welcome Admin! This bot manages TikTok cut price links.\n\n` +
                    `👑 *Admin Commands:*\n` +
                    `/submit <url> - Submit a TikTok link\n` +
                    `/setup - Create the private group\n` +
                    `/invite - Get group invite link\n` +
                    `/blast - Manually trigger link blast\n` +
                    `/stats - View today's click stats\n` +
                    `/nonclickers - View who hasn't clicked today\n\n` +
                    `📋 *Regular Commands:*\n` +
                    `/myid - Get your Telegram ID`;
            } else {
                welcomeMsg += `Welcome to the TikTok Cut Price system!\n\n` +
                    `📋 *Commands:*\n` +
                    `/myid - Get your Telegram ID\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚠️ *Anda adalah Ahli Biasa*\n` +
                    `Link harian akan dihantar ke dalam Group. Pastikan anda klik semua link untuk mengelakkan daripada dibuang.`;
            }

            bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
        }
    });

    // ── /myid command ──
    bot.onText(/\/myid/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🆔 Your Telegram ID: \`${msg.from.id}\`\n\nSet this as ADMIN_TELEGRAM_ID in .env file.`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /submit command (Admin only) ──
    bot.onText(/\/submit (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);
        const url = match[1].trim();

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            bot.sendMessage(chatId, '❌ Please provide a valid URL (must start with http:// or https://).');
            return;
        }

        const submitterName = msg.from.username || msg.from.first_name || 'Unknown';
        const submitterId = String(msg.from.id);

        try {
            db.addLink(url, '', '', null, submitterName, submitterId);
            bot.sendMessage(chatId,
                `✅ *Link Submitted!*\n\n` +
                `🔗 ${url}\n` +
                `📤 By: ${submitterName}\n` +
                `📊 Status: Pending\n\n` +
                `The link will be included in the daily blast.`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            bot.sendMessage(chatId, `❌ Error submitting link: ${err.message}`);
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
                `⚠️ Group already set up!\n\nGroup Chat ID: \`${groupChatId}\`\n\nUse /invite to get the invite link.`,
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
                member_limit: MAX_MEMBERS,
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

    // ── /invite command (Admin only) ──
    bot.onText(/\/invite/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = String(msg.from.id);

        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Admin only command.');
            return;
        }

        const targetGroup = groupChatId || db.getSetting('group_chat_id');
        if (!targetGroup) {
            bot.sendMessage(chatId, '❌ No group registered yet. Use /setup first.');
            return;
        }

        try {
            // Always generate a fresh invite link
            const link = await bot.createChatInviteLink(targetGroup, {
                name: 'Cut Price Group Invite',
                member_limit: MAX_MEMBERS,
                creates_join_request: false
            });
            const inviteLink = link.invite_link;
            db.setSetting('invite_link', inviteLink);

            bot.sendMessage(chatId,
                `🔗 *Group Invite Link:*\n\n${inviteLink}\n\n👥 Max members: ${MAX_MEMBERS}\n\n_Link freshly generated ✅_`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            bot.sendMessage(chatId, `❌ Could not generate invite link: ${err.message}`);
        }
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
    try {
        if (isAdmin(userId)) {
            // Special commands for admins
            await bot.setMyCommands([
                { command: 'start', description: 'Main menu' },
                { command: 'submit', description: 'Submit a TikTok link' },
                { command: 'blast', description: 'Trigger link blast' },
                { command: 'stats', description: 'View click stats' },
                { command: 'invite', description: 'Get group invite link' },
                { command: 'setup', description: 'Configure group' },
                { command: 'myid', description: 'Check my ID' }
            ], { scope: { type: 'chat', chat_id: userId } });
        } else {
            // Basic commands for regular users
            await bot.setMyCommands([
                { command: 'start', description: 'Main menu' },
                { command: 'myid', description: 'Check my ID' }
            ], { scope: { type: 'chat', chat_id: userId } });
        }
    } catch (err) {
        console.error('Error setting bot commands:', err.message);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────
function isAdmin(userId) {
    const envAdminId = process.env.ADMIN_TELEGRAM_ID;

    // 1. Check .env (highest priority)
    if (envAdminId && envAdminId.trim() !== '') {
        const isEnvAdmin = String(userId) === String(envAdminId).trim();
        if (isEnvAdmin) return true;
    }

    // 2. Fallback to database
    const savedAdmin = db.getSetting('admin_id');
    const isDbAdmin = String(userId) === String(savedAdmin);

    return isDbAdmin;
}

function getBot() {
    return bot;
}

function getGroupChatId() {
    return groupChatId || db.getSetting('group_chat_id');
}

// ─── Blast Function ──────────────────────────────────────────────
async function triggerBlast() {
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    const targetGroupId = getGroupChatId();

    if (!targetGroupId) {
        return '❌ No group registered. Use /setup and /register first.';
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

    let message = `🎯 *CUT PRICE TIKTOK — Daily Links*\n`;
    message += `📅 ${today}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const botUsername = botInfo ? botInfo.username : 'BotUsername';

    for (let i = 0; i < pendingLinks.length; i++) {
        const link = pendingLinks[i];
        const title = link.title || link.submitter_name || `Link #${i + 1}`;
        // Deep link format: https://t.me/botname?start=L_ID
        const deepLink = `https://t.me/${botUsername}?start=L_${link.id}`;

        message += `${i + 1}. *${title}*\n`;
        message += `🔗 [Tap here to open link](${deepLink})\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⚠️ *Klik semua link di atas!*\n`;
    message += `📊 Admin akan monitor siapa yang tidak klik.`;

    try {
        // Send the complete message with all links
        const sentMsg = await bot.sendMessage(targetGroupId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });

        // Mark all links as blasted
        for (let i = 0; i < pendingLinks.length; i++) {
            const link = pendingLinks[i];
            db.updateLinkStatus(link.id, 'blasted');
            db.addBlastRecord(today, link.id, String(sentMsg.message_id));
        }

        return `✅ *Blast Complete!*\n\n📨 ${pendingLinks.length} links sent to group.\n📊 Tracking active.`;
    } catch (err) {
        return `❌ Blast error: ${err.message}`;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { initBot, getBot, getGroupChatId, triggerBlast, isAdmin };

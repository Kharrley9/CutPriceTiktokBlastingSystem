const TelegramBot = require('node-telegram-bot-api');
const GitHubDatabase = require('./github-db');

class TelegramBotGitHub {
  constructor() {
    this.bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
    this.db = new GitHubDatabase();
    this.isAdmin = (userId) => userId === parseInt(process.env.ADMIN_TELEGRAM_ID);
  }

  async runManualBlast() {
    console.log('Running manual blast...');
    await this.performBlast();
  }

  async runScheduledBlast() {
    console.log('Running scheduled blast...');
    await this.performBlast();
  }

  async performBlast() {
    try {
      const groupId = await this.db.getSetting('TELEGRAM_GROUP_ID');
      if (!groupId) {
        console.log('No group ID configured');
        return;
      }

      const links = await this.db.getPendingLinks(parseInt(await this.db.getSetting('LINKS_PER_BLAST') || '10'));
      
      if (links.length === 0) {
        console.log('No pending links to blast');
        return;
      }

      for (const link of links) {
        const message = `🎯 *CUT PRICE BLAST* 🎯\n\n` +
          `🔗 ${link.title || 'New Link'}\n` +
          `${link.description || ''}\n\n` +
          `👆 Click to claim your cut price deal!\n` +
          `#cutprice #tiktok #blast`;

        try {
          const sentMessage = await this.bot.sendMessage(groupId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          });

          // Update link status
          await this.db.updateLinkStatus(link.id, 'blasted');
          
          // Add to blast history
          const data = await this.db.loadData();
          data.blastHistory.push({
            id: Date.now(),
            blast_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
            link_id: link.id,
            message_id: sentMessage.message_id.toString(),
            sent_at: new Date().toISOString()
          });
          await this.db.saveData(data);

          console.log(`Blasted link ${link.id}: ${link.title}`);
          
          // Add delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Failed to blast link ${link.id}:`, error.message);
        }
      }

      console.log(`Blast completed. Sent ${links.length} links.`);
      
    } catch (error) {
      console.error('Blast failed:', error);
    }
  }

  async setupCommands() {
    // This would be used if you want to handle Telegram commands
    // For GitHub Actions, we mainly focus on scheduled blasting
    console.log('Bot setup complete');
  }
}

// CLI interface for GitHub Actions
async function main() {
  const bot = new TelegramBotGitHub();
  await bot.setupCommands();

  const args = process.argv.slice(2);
  
  if (args.includes('--manual-blast')) {
    await bot.runManualBlast();
  } else if (args.includes('--scheduled')) {
    await bot.runScheduledBlast();
  } else {
    console.log('Usage: node bot-github.js [--manual-blast|--scheduled]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TelegramBotGitHub;

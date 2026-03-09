# 🎯 CutPrice TikTok Blasting System - GitHub Edition

**100% GitHub-Powered Solution** - No external hosting required!

---

## 🌟 What's Different?

This version runs **entirely on GitHub**:
- 📊 **Dashboard**: Hosted on GitHub Pages (free)
- 🤖 **Bot Automation**: GitHub Actions (scheduled & manual)
- 💾 **Database**: GitHub repository as storage (JSON files)
- 🚀 **Deployment**: Automatic on every push

---

## ⚡ Quick Setup

### 1. Fork This Repository
```bash
# Fork this repo to your GitHub account
# Then clone your fork:
git clone https://github.com/YOUR_USERNAME/CutPriceTiktokBlastingSystem.git
cd CutPriceTiktokBlastingSystem
```

### 2. Create Telegram Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send: `/newbot`
3. Choose a name and username
4. Copy the **BOT_TOKEN**

### 3. Configure GitHub Secrets
Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:
```
BOT_TOKEN=your_bot_token_from_step_2
ADMIN_TELEGRAM_ID=your_telegram_user_id
GITHUB_TOKEN=your_personal_access_token
```

**Get your Telegram ID**: Message [@userinfobot](https://t.me/userinfobot)

**Create GitHub Token**:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Check: `repo` (full control)
4. Copy the token (starts with `ghp_`)

### 4. Enable GitHub Pages
1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` + `/ (root)`
4. Save

### 5. Enable GitHub Actions
1. Repo → **Actions** tab
2. Click **I understand my workflows, go ahead and enable them**

---

## 🚀 Usage

### Dashboard Access
- URL: `https://YOUR_USERNAME.github.io/CutPriceTiktokBlastingSystem`
- Click "GitHub Authentication"
- Enter your Personal Access Token
- Manage links, view stats, trigger blasts

### Bot Commands
- `/start` - Initialize bot
- `/setup` - Configure your group
- `/blast` - Manual blast (admin only)
- `/stats` - View statistics

### Automated Blasting
- **Daily**: Runs automatically at 09:00 GMT+8
- **Manual**: Trigger from dashboard or `/blast` command

---

## 📊 Features

### 🎯 Core Functionality
- ✅ **Link Management**: Add, edit, delete links
- ✅ **Member Tracking**: Individual click tracking
- ✅ **Scheduled Blasting**: Daily automatic blasts
- ✅ **Real-time Analytics**: Charts and statistics
- ✅ **Priority Queue**: Move links to front of queue

### 🌍 GitHub Integration
- ✅ **Zero Cost**: No hosting fees
- ✅ **Automatic Deployment**: Push to deploy
- ✅ **Version Control**: All changes tracked
- ✅ **Backup**: GitHub's infrastructure
- ✅ **Collaboration**: Multiple admins

---

## 📁 Project Structure

```
CutPriceTiktokBlastingSystem/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # GitHub Pages deployment
│       └── telegram-bot.yml    # Bot automation
├── index-github.html           # Main dashboard
├── frontend-github.js          # GitHub API client
├── bot-github.js              # GitHub Actions bot
├── github-db.js               # GitHub database layer
├── style.css                  # Styling (unchanged)
├── package.json               # Dependencies
└── README-GITHUB.md           # This file
```

---

## 🔧 Configuration

### Environment Variables (.env.github)
```env
BOT_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
GITHUB_TOKEN=your_personal_access_token
REPO_OWNER=your_github_username
REPO_NAME=CutPriceTiktokBlastingSystem
BLAST_TIME=09:00
LINKS_PER_BLAST=10
```

### Blast Schedule
- **Default**: Daily at 09:00 GMT+8
- **Timezone**: Malaysia/Singapore
- **Customizable**: Edit `.github/workflows/telegram-bot.yml`

---

## 🚨 Important Notes

### Rate Limits
- **GitHub API**: 5,000 requests/hour (authenticated)
- **Telegram Bot**: 30 messages/second to same chat
- **Solution**: Built-in delays and batching

### Data Storage
- **Format**: JSON in repository (`data.json`)
- **Backup**: Git history + GitHub's infrastructure
- **Size Limit**: ~100MB per file (GitHub limit)

### Security
- **Tokens**: Stored in GitHub Secrets (never in code)
- **Authentication**: Required for dashboard access
- **Admin Control**: Only ADMIN_TELEGRAM_ID can manage

---

## 🔄 Migration from Original

If you're migrating from the SQLite version:

1. **Export your data**:
   ```bash
   node export-sqlite-to-json.js
   ```

2. **Import to GitHub**:
   - Copy the generated JSON to `data.json`
   - Commit and push to repository

3. **Update your bot**:
   - New bot token (recommended)
   - Or keep existing token

---

## 🐛 Troubleshooting

### Common Issues

**Dashboard not loading?**
- Check GitHub Pages is enabled
- Verify repository is public
- Check Actions tab for deployment errors

**Bot not working?**
- Verify BOT_TOKEN in Secrets
- Check Actions logs for errors
- Ensure bot is added to your group

**Authentication failed?**
- Verify GitHub token has `repo` scope
- Check token hasn't expired
- Ensure correct username in repo URL

### Debug Mode
Enable debug logging by adding to Actions:
```yaml
env:
  DEBUG: true
```

---

## 📈 Scaling

### Performance Tips
- **Large datasets**: Consider splitting data files
- **High traffic**: Use GitHub Pro for higher limits
- **Multiple groups**: Create separate repositories

### Advanced Features
- **Webhooks**: Real-time updates
- **Branching**: Staging environments
- **Releases**: Versioned deployments

---

## 💡 Tips & Tricks

### Dashboard Shortcuts
- `Ctrl+R`: Quick refresh
- `Ctrl+E`: Export data
- `Ctrl+N`: Add new link

### Bot Efficiency
- Batch messages to avoid rate limits
- Use priority for important links
- Monitor click-through rates

### GitHub Best Practices
- Commit messages: Use descriptive messages
- Branch protection: Keep main stable
- Pull requests: Review before merging

---

## 🆘 Support

### Getting Help
1. **Check Actions logs**: Most errors visible there
2. **GitHub Issues**: Report bugs in this repo
3. **Telegram**: Message the bot for status

### Community
- **Discussions**: GitHub Discussions tab
- **Wiki**: Additional documentation
- **Examples**: Sample configurations

---

## 📄 License

Personal Use Only. All rights reserved.

---

**🎉 Congratulations! You now have a 100% GitHub-powered TikTok blasting system!**

*No hosting fees, no server maintenance, just pure GitHub automation.*

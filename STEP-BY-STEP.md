# 🎯 Step-by-Step Setup Guide
## CutPrice TikTok Blasting System - GitHub Edition

---

## 📋 Prerequisites
- GitHub account
- Telegram account
- 10-15 minutes

---

## 🚀 STEP 1: Create Telegram Bot

### 1A. Message BotFather
1. Open Telegram
2. Search for **@BotFather** (blue checkmark)
3. Send: `/newbot`
4. BotFather asks for bot name: `CutPrice Blaster`
5. BotFather asks for username: `YourBotName_bot` (must end with `_bot`)
6. **Copy the BOT_TOKEN** (starts with `1234567890:ABC...`)

### 1B. Get Your Telegram ID
1. Search for **@userinfobot** 
2. Send any message
3. **Copy your User ID** (numbers only)

---

## 🔐 STEP 2: Create GitHub Personal Access Token

### 2A. Generate Token
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in:
   - **Note**: `CutPrice Bot Token`
   - **Expiration**: `No expiration` or `90 days`
   - **Select scopes**: Check ✅ `repo` (full control)
4. Click **"Generate token"**
5. **Copy the token** (starts with `ghp_`)

### 2B. Keep Token Safe
- Save it somewhere safe
- You'll need it in Step 4
- It won't be shown again

---

## ⚙️ STEP 3: Configure Repository Settings

### 3A. Enable GitHub Pages
1. Go to: https://github.com/Kharrley9/CutPriceTiktokBlastingSystem
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Source: **Deploy from a branch**
5. Branch: `main` + `/ (root)`
6. Click **Save**

### 3B. Enable GitHub Actions
1. Click **Actions** tab
2. If you see a warning, click **"I understand my workflows, go ahead and enable them"**

---

## 🔑 STEP 4: Add GitHub Secrets

### 4A. Navigate to Secrets
1. Go to repository **Settings**
2. Scroll down to **Secrets and variables** → **Actions**
3. Click **"New repository secret"**

### 4B. Add Three Secrets

#### Secret 1: BOT_TOKEN
- **Name**: `BOT_TOKEN`
- **Value**: Your bot token from Step 1A
- Click **Add secret**

#### Secret 2: ADMIN_TELEGRAM_ID  
- **Name**: `ADMIN_TELEGRAM_ID`
- **Value**: Your Telegram ID from Step 1B
- Click **Add secret**

#### Secret 3: PERSONAL_GITHUB_TOKEN
- **Name**: `PERSONAL_GITHUB_TOKEN`
- **Value**: Your personal access token from Step 2A
- Click **Add secret**

---

## 🤖 STEP 5: Initialize Telegram Bot

### 5A. Start Your Bot
1. Search for your bot on Telegram (use the username from Step 1A)
2. Click **Start** or send `/start`
3. Bot should respond with welcome message

### 5B. Add Bot to Your Group
1. Create a **private group** on Telegram
2. Add your bot to the group
3. Make bot an **admin** in the group
4. Send `/setup` in the group to register it

---

## 📊 STEP 6: Access Dashboard

### 6A. Wait for Deployment
- GitHub Pages takes 2-3 minutes to deploy
- Check: https://Kharrley9.github.io/CutPriceTiktokBlastingSystem

### 6B. Authenticate Dashboard
1. Open the dashboard URL
2. Click **"GitHub Authentication"**
3. Enter your **GitHub Personal Access Token** (from Step 2A)
4. Click **"Authenticate"**

### 6C. Add Your First Link
1. Click **"➕ Add Link"**
2. Fill in:
   - **URL**: Your TikTok cut price link
   - **Title**: Short description
   - **Description**: Details (optional)
3. Click **"Add Link"**

---

## 🚀 STEP 7: Test Your System

### 7A. Manual Blast Test
1. In dashboard: Click **"🚀 Manual Blast"**
2. Confirm: Click **OK**
3. Check your Telegram group - should see the blast!

### 7B. Schedule Test
1. Bot will automatically blast daily at 09:00 GMT+8
2. You can also trigger via Telegram: Send `/blast` to bot

---

## 🔧 STEP 8: Verify Everything Works

### 8A. Check GitHub Actions
1. Go to **Actions** tab in repository
2. You should see workflows running
3. Green checkmarks = success

### 8B. Test Click Tracking
1. Click on the blasted link in Telegram
2. Refresh dashboard
3. Should show click activity in **🔥 Activity** tab

---

## 📱 Mobile Setup (Optional)

### For Phone Access
1. Save dashboard URL to phone home screen
2. Use Telegram app for bot commands
3. Monitor blasts and stats from anywhere

---

## 🎉 SUCCESS! 

Your system is now 100% GitHub-powered:
- ✅ **No hosting costs**
- ✅ **Automatic daily blasts** 
- ✅ **Real-time dashboard**
- ✅ **Click tracking**
- ✅ **Version controlled**

---

## 🆘 Troubleshooting

### Dashboard Not Loading?
- Wait 3-5 minutes for GitHub Pages
- Check Actions tab for deployment errors
- Verify repository is public

### Bot Not Working?
- Check BOT_TOKEN in Secrets
- Verify bot is admin in group
- Check Actions logs for errors

### Authentication Failed?
- Verify GitHub token has `repo` scope
- Check token hasn't expired
- Ensure correct username in URL

---

## 📞 Need Help?

1. **Check Actions logs** in GitHub repository
2. **Review this guide** step by step
3. **Test each component** individually

**🎯 You're all set! Your TikTok blasting system is live on GitHub!**

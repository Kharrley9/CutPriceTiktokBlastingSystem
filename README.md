# 🎯 CutPriceTiktok Blasting System

<div align="center">

## 🎯

**A professional, automated Telegram blasting system designed for TikTok "Cut Price" link distribution**

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/telegram-2CA5E0?logo=telegram&logoColor=white)](https://t.me/)

---

## 📱 Features Overview

| Feature | Description |
|---------|-------------|
| 🤖 **Smart Bot** | Automated Telegram bot with time restrictions & admin controls |
| 📊 **Dashboard** | Beautiful glassmorphism admin interface |
| 📈 **Analytics** | Real-time click tracking & member engagement |
| ⏰ **Auto Reminders** | Daily reminders for pending link updates |
| 🛡️ **Security** | Admin-only access & member management |
| 🌍 **Localized** | Malaysia Time (GMT+8) synchronization |

</div>

---

## ✨ Core Features

### 🤖 **Advanced Bot System**
- **Time-Restricted Submissions**: 3:00 PM - 11:59 PM (Malaysia Time)
- **Admin 24-Hour Access**: Maintenance and control anytime
- **Auto Reminder System**: Daily reminders at 3:00 PM for pending links
- **Smart Command Handling**: Comprehensive admin and user commands
- **Member Validation**: Real-time member limit enforcement

### 📊 **Professional Dashboard**
- **Glassmorphism Design**: Modern, beautiful UI
- **Real-Time Statistics**: Live click tracking and analytics
- **Member Management**: View and manage active members
- **Link Queue Control**: Add, remove, and prioritize links
- **Bulk Operations**: Import/export links from CSV/Excel

### 📈 **Advanced Analytics**
- **30-Day Activity Charts**: Visual engagement tracking
- **Member Engagement Rate**: Unique clickers vs total members
- **Daily Non-Clickers List**: Identify inactive members
- **Click Attribution**: Track which member clicked which link
- **Historical Data**: Complete blast and click history

### 🛡️ **Security & Control**
- **Admin-Only Commands**: Restricted access to sensitive operations
- **Member Limit Enforcement**: Automatic excess member removal
- **Deep Link Technology**: Secure member identification
- **Session Management**: Secure dashboard authentication

---

## 🚀 Quick Start

### 📦 Prerequisites
- **Node.js**: v16.x or higher
- **Telegram Bot**: Created via [@BotFather](https://t.me/botfather)
- **Private Group**: For link distribution

### 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/Kharrley9/CutPriceTiktokBlastingSystem.git
cd CutPriceTiktokBlastingSystem

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### ⚙️ Configuration

Create your `.env` file with the following settings:

```env
# ── Bot Configuration ────────────────────────────────────────
BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_ID=your_admin_telegram_id

# ── Server Configuration ─────────────────────────────────────
PORT=3000
PUBLIC_URL=http://your_vps_ip_or_domain

# ── Blast Schedule (Malaysia Time GMT+8) ─────────────────────
BLAST_TIME=22:00
BLAST_TIMEZONE=Asia/Kuala_Lumpur

# ── System Limits ────────────────────────────────────────────
MAX_MEMBERS=100
LINKS_PER_BLAST=10
```

---

## 📖 Usage Guide

### 🚀 **Getting Started**

1. **Start the Server**
```bash
npm start
```

2. **Access Dashboard**
   - Open `http://localhost:3000`
   - Login with your admin credentials

3. **Bot Setup**
   - Send `/start` to your bot in Telegram
   - Follow the `/setup` instructions to register your group

### 🤖 **Bot Commands**

#### 👑 **Admin Commands**
| Command | Description |
|---------|-------------|
| `/start` | Main menu with admin options |
| `/setup` | Create and configure private group |
| `/mygroup` | Check/auto-detect group ID |
| `/cleargroup` | Clear old group ID |
| `/instructions` | Post group instructions |
| `/remindpending` | Remind members with pending links |
| `/blast` | Manually trigger link blast |
| `/stats` | View today's click statistics |
| `/nonclickers` | View inactive members |

#### 👥 **Member Commands**
| Command | Description |
|---------|-------------|
| `/start` | Welcome message and guide |
| `/submit <url> <name>` | Submit/Update TikTok link |
| `/mylink` | Check current link status |
| `/cutqueue` | Request queue priority (paid) |
| `/myid` | Get Telegram ID |

### ⏰ **Time Management**

#### **Member Submission Hours**
- **Allowed**: 3:00 PM - 11:59 PM (Malaysia Time)
- **Blocked**: 12:00 AM - 2:59 PM
- **Admin Access**: 24 hours (maintenance)

#### **Daily Schedule**
- **3:00 PM**: Auto reminder for pending links
- **10:00 PM**: Daily link blast
- **24/7**: Admin controls and monitoring

---

## 🌐 Deployment

### ☁️ **VPS Deployment (Recommended)**

For 24/7 reliability, deploy on a KVM VPS:

```bash
# Install PM2 process manager
npm install pm2 -g

# Start the application
pm2 start server.js --name "tiktok-blaster"

# Monitor the process
pm2 monit

# View logs
pm2 logs tiktok-blaster
```

### 🐳 **Docker Deployment**

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t tiktok-blaster .
docker run -d -p 3000:3000 tiktok-blaster
```

---

## 📊 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │    │   Express App   │    │  SQLite Database│
│                 │    │                 │    │                 │
│ • Commands      │◄──►│ • Dashboard     │◄──►│ • Links         │
│ • Time Rules    │    │ • API Routes    │    │ • Members       │
│ • Auto Reminders│    │ • Session Mgmt  │    │ • Statistics    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Cron Scheduler │
                    │                 │
                    │ • Daily Blast   │
                    │ • Auto Reminder │
                    └─────────────────┘
```

---

## 🔧 Development

### 📁 **Project Structure**

```
CutPriceTiktokBlastingSystem/
├── 📄 Core Files
│   ├── server.js          # Express server & API
│   ├── bot.js             # Telegram bot logic
│   ├── database.js        # SQLite database operations
│   ├── scheduler.js       # Cron job management
│   └── tracker.js         # Click tracking system
├── 📄 Frontend
│   ├── index.html         # Admin dashboard
│   ├── login.html         # Authentication page
│   ├── app.js             # Frontend JavaScript
│   └── style.css          # Styling & animations
├── 📄 Configuration
│   ├── .env               # Environment variables
│   ├── .env.example       # Configuration template
│   └── package.json       # Dependencies & scripts
└── 📁 Data
    ├── data/cutprice.db   # SQLite database
    └── assets/logo.png    # Application logo
```

### 🛠️ **Technologies Used**

| Technology | Purpose |
|------------|---------|
| **Node.js** | Backend runtime |
| **Express** | Web framework |
| **Telegram Bot API** | Bot communication |
| **node-cron** | Scheduled tasks |
| **better-sqlite3** | Database |
| **express-session** | Session management |
| **HTML/CSS/JS** | Frontend dashboard |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For support and questions:

- **Telegram**: [@Kharrley](https://t.me/Kharrley)
- **GitHub Issues**: [Create an issue](https://github.com/Kharrley9/CutPriceTiktokBlastingSystem/issues)
- **Documentation**: Check this README and inline code comments

---

## 📄 License

<div align="center">

**Personal Use Only**  
All rights reserved © 2026 Kharrley9

Made with ❤️ for the TikTok Cut Price Community

</div>
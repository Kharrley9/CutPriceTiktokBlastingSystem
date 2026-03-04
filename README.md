# CutPriceTiktok Blasting System 🚀

An automated Telegram blasting system for managing and distributing TikTok Cut Price links. This system allows admins to queue links via a dashboard or spreadsheet import, which are then automatically blasted to a Telegram group at a scheduled time.

## ✨ Features
- **📊 Admin Dashboard:** Professional, mobile-responsive web interface to manage your system.
- **🤖 Telegram Integration:** Automated posting to groups with member limit enforcement.
- **📈 Click Tracking:** Monitor which members are clicking your links in real-time.
- **📁 Spreadsheet Import:** Bulk import links from Google Forms or Excel/CSV files (detects "Nama :" and "Link CutPriceTiktok :").
- **🗑️ List Management:** Easily clear your queue with the "Remove All" feature.
- **📱 Mobile Optimized:** Tidy and functional UI for managing on the go.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express
- **Database:** SQLite (Better-SQLite3)
- **Bot Library:** Node-Telegram-Bot-API
- **Frontend:** Vanilla JS, CSS (Glassmorphism design)
- **Sheet Parsing:** SheetJS

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- A Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Kharrley9/CutPriceTiktokBlastingSystem.git
cd CutPriceTiktokBlastingSystem

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_TELEGRAM_ID=your_id
PORT=3000
PUBLIC_URL=http://localhost:3000
BLAST_TIME=09:00
MAX_MEMBERS=100
LINKS_PER_BLAST=10
```

### 4. Running the System
```bash
# Start the server
node server.js
```
Access the dashboard at `http://localhost:3000`

## ☁️ Deployment
For 24/7 operation, it is recommended to host on a **KVM VPS** (e.g., Hostinger, Vultr) using **PM2** to keep the process alive.

## 📄 License
This project is for personal use.

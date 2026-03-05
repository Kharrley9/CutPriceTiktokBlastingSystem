require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');
const trackerRoutes = require('./tracker');
const session = require('express-session');
const { initBot, triggerBlast } = require('./bot');
const { initScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Session Configuration ────────────────────────────────────────
app.use(session({
    secret: 'cut-price-blast-premium-secret-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ─── Auth Middleware ──────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        // If it's an API call, return 401
        if (req.path.startsWith('/api') && req.path !== '/api/login') {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Otherwise redirect to login
        res.redirect('/login.html');
    }
};

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Public Routes (No Auth Required) ─────────────────────────────
// Serve assets folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API: Login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === '123cpt') {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Password salah' });
    }
});

// Serve Login Page
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ─── Click Tracking Routes (Public) ──────────────────────────────
app.use('/', trackerRoutes);

// ─── Protected Routes (Auth Required) ─────────────────────────────
// Protection for dashboard and API
app.use('/api', authMiddleware);

// Explicitly serve frontend files with protection
app.get('/', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/style.css', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'style.css')));

// API: Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ─── API: Links ──────────────────────────────────────────────────
app.get('/api/links', (req, res) => {
    try {
        const links = db.getAllLinks();
        res.json({ success: true, data: links });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/links', (req, res) => {
    try {
        const { url, title, description, priority_order } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
        const result = db.addLink(url, title || '', description || '', priority_order || null);
        const queue_position = db.getPendingCount();
        res.json({ success: true, id: result.lastInsertRowid, queue_position });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/links/:id', (req, res) => {
    try {
        const { url, title, description, priority_order, status } = req.body;
        const link = db.getLinkById(parseInt(req.params.id));
        if (!link) return res.status(404).json({ success: false, error: 'Link not found' });

        if (status) {
            db.updateLinkStatus(parseInt(req.params.id), status);
        }
        if (url !== undefined) {
            db.updateLink(
                parseInt(req.params.id),
                url || link.url,
                title !== undefined ? title : link.title,
                description !== undefined ? description : link.description,
                priority_order !== undefined ? priority_order : link.priority_order
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/links/:id/cut', (req, res) => {
    try {
        db.cutQueueLink(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/links/:id', (req, res) => {
    try {
        if (req.params.id === 'all') {
            db.deleteAllLinks();
        } else {
            db.deleteLink(parseInt(req.params.id));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── API: Members ────────────────────────────────────────────────
app.get('/api/members', (req, res) => {
    try {
        const members = db.getAllMembers();
        res.json({ success: true, data: members });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── API: Stats ──────────────────────────────────────────────────
app.get('/api/stats/today', (req, res) => {
    try {
        const todayClicks = db.getTodayClicks();
        const todayBlasts = db.getTodayBlasts();
        const members = db.getAllMembers();
        const nonClickers = db.getNonClickersToday();
        const clickedToday = db.getMemberClickedToday();

        res.json({
            success: true,
            data: {
                total_clicks: todayClicks.length,
                links_blasted: todayBlasts.length,
                total_members: members.length,
                clickers: clickedToday.length,
                non_clickers: nonClickers.length,
                click_rate: members.length > 0 ? Math.round((clickedToday.length / members.length) * 100) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/stats/non-clickers', (req, res) => {
    try {
        const nonClickers = db.getNonClickersToday();
        res.json({ success: true, data: nonClickers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/stats/daily', (req, res) => {
    try {
        const stats = db.getDailyStats();
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/stats/overview', (req, res) => {
    try {
        const totalLinks = db.getLinkCount();
        const pendingLinks = db.getPendingCount();
        const totalMembers = db.getActiveCount();
        const inviteLink = db.getSetting('invite_link');
        const groupId = db.getSetting('group_chat_id');

        res.json({
            success: true,
            data: {
                total_links: totalLinks,
                pending_links: pendingLinks,
                total_members: totalMembers,
                max_members: parseInt(process.env.MAX_MEMBERS) || 100,
                invite_link: inviteLink,
                group_configured: !!groupId,
                blast_time: process.env.BLAST_TIME || '09:00',
                links_per_blast: parseInt(process.env.LINKS_PER_BLAST) || 10
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── API: Blast ──────────────────────────────────────────────────
app.get('/api/blast/history', (req, res) => {
    try {
        const history = db.getBlastHistory();
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/blast/trigger', async (req, res) => {
    try {
        const result = await triggerBlast();
        res.json({ success: true, message: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/blast/today', (req, res) => {
    try {
        const todayBlasts = db.getTodayBlasts();
        res.json({ success: true, data: todayBlasts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── API: Settings ───────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
    try {
        const settings = {
            blast_time: process.env.BLAST_TIME || '09:00',
            max_members: parseInt(process.env.MAX_MEMBERS) || 100,
            links_per_blast: parseInt(process.env.LINKS_PER_BLAST) || 10,
            public_url: process.env.PUBLIC_URL || 'http://localhost:3000',
            invite_link: db.getSetting('invite_link') || 'Not generated yet',
            group_id: db.getSetting('group_chat_id') || 'Not configured'
        };
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const { blast_time, links_per_blast, max_members } = req.body;
        const fs = require('fs');
        const envPath = require('path').join(__dirname, '.env');

        if (!blast_time && !links_per_blast && !max_members) {
            return res.status(400).json({ success: false, error: 'No settings provided' });
        }

        // Update runtime values immediately
        if (blast_time) process.env.BLAST_TIME = blast_time;
        if (links_per_blast) process.env.LINKS_PER_BLAST = String(links_per_blast);
        if (max_members) process.env.MAX_MEMBERS = String(max_members);

        // Persist to .env file
        let envContent = fs.readFileSync(envPath, 'utf8');

        if (blast_time) {
            envContent = envContent.replace(/^BLAST_TIME=.*/m, `BLAST_TIME=${blast_time}`);
        }
        if (links_per_blast) {
            envContent = envContent.replace(/^LINKS_PER_BLAST=.*/m, `LINKS_PER_BLAST=${links_per_blast}`);
        }
        if (max_members) {
            envContent = envContent.replace(/^MAX_MEMBERS=.*/m, `MAX_MEMBERS=${max_members}`);
        }

        fs.writeFileSync(envPath, envContent, 'utf8');

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 CutPriceTiktok Blasting System running at http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);

    // Initialize Telegram bot
    try {
        initBot();
    } catch (err) {
        console.error('❌ Bot init error:', err.message);
    }

    // Initialize scheduler
    try {
        initScheduler();
    } catch (err) {
        console.error('❌ Scheduler init error:', err.message);
    }

    console.log('\n✅ System ready!\n');
});

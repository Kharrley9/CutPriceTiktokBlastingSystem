const express = require('express');
const db = require('./database');

const router = express.Router();

// ─── Click Tracking Redirect ─────────────────────────────────────
// URL format: /click/:linkId/:memberId
// memberId 0 = unknown/general click, will still redirect

router.get('/click/:linkId/:memberId', (req, res) => {
  const { linkId, memberId } = req.params;
  const userAgent = req.headers['user-agent'] || '';

  const link = db.getLinkById(parseInt(linkId));

  if (!link) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Link Not Found</title></head>
      <body style="background:#0f0f23;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
        <div style="text-align:center">
          <h1>❌ Link Not Found</h1>
          <p>This link does not exist or has expired.</p>
        </div>
      </body></html>
    `);
  }

  // Log the click
  try {
    // Only avoid duplicates if we have a real member ID
    if (memberId && memberId !== '0') {
      if (!db.hasClickedLink(parseInt(linkId), memberId)) {
        db.addClick(parseInt(linkId), memberId, userAgent);
      }
    } else {
      // Log general click (memberId 0)
      db.addClick(parseInt(linkId), '0', userAgent);
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Serve a redirect page with tracking
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to TikTok...</title>
      <meta http-equiv="refresh" content="1;url=${link.url}">
      <style>
        body {
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          font-family: 'Segoe UI', sans-serif;
        }
        .container {
          text-align: center;
          animation: fadeIn 0.5s ease;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #00d4aa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        h2 { color: #00d4aa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>✅ Click Recorded!</h2>
        <p>Redirecting to TikTok...</p>
      </div>
      <script>
        setTimeout(function() {
          window.location.href = "${link.url}";
        }, 1000);
      </script>
    </body>
    </html>
  `);
});

// ─── Click Stats Page (embeddable) ───────────────────────────────
router.get('/click-stats/:linkId', (req, res) => {
  const linkId = parseInt(req.params.linkId);
  const link = db.getLinkById(linkId);

  if (!link) {
    return res.json({ error: 'Link not found' });
  }

  const clicks = db.getClicksForLink(linkId);
  const clickCount = db.getClickCountForLink(linkId);

  res.json({
    link_id: linkId,
    url: link.url,
    title: link.title,
    total_unique_clicks: clickCount,
    clicks: clicks.map(c => ({
      member_id: c.member_telegram_id,
      username: c.username,
      name: c.first_name,
      clicked_at: c.clicked_at
    }))
  });
});

module.exports = router;

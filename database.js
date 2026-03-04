const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'cutprice.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    priority_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'queued', 'blasted', 'expired')),
    submitted_by TEXT DEFAULT 'admin',
    submitted_by_id TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    blasted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    total_clicks INTEGER DEFAULT 0,
    last_click_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS click_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    member_telegram_id TEXT NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT DEFAULT '',
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blast_date DATE NOT NULL,
    link_id INTEGER NOT NULL,
    message_id TEXT DEFAULT '',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
  CREATE INDEX IF NOT EXISTS idx_links_priority ON links(priority_order);
  CREATE INDEX IF NOT EXISTS idx_click_tracking_link ON click_tracking(link_id);
  CREATE INDEX IF NOT EXISTS idx_click_tracking_member ON click_tracking(member_telegram_id);
  CREATE INDEX IF NOT EXISTS idx_click_tracking_date ON click_tracking(clicked_at);
  CREATE INDEX IF NOT EXISTS idx_blast_history_date ON blast_history(blast_date);
  CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active);
`);

// ─── Settings ────────────────────────────────────────────────────
const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
`);

// ─── Links ───────────────────────────────────────────────────────
const addLink = db.prepare(`
  INSERT INTO links (url, title, description, priority_order, submitted_by, submitted_by_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getNextPriority = db.prepare('SELECT COALESCE(MAX(priority_order), 0) + 1 AS next FROM links');

const getAllLinks = db.prepare(`
  SELECT l.*, (SELECT COUNT(*) FROM click_tracking WHERE link_id = l.id) as click_count
  FROM links l
  ORDER BY l.priority_order ASC, l.created_at ASC
`);

const getPendingLinks = db.prepare(`
  SELECT * FROM links WHERE status = 'pending'
  ORDER BY priority_order ASC, created_at ASC
  LIMIT ?
`);

const updateLinkStatus = db.prepare('UPDATE links SET status = ?, blasted_at = CURRENT_TIMESTAMP WHERE id = ?');

const updateLink = db.prepare('UPDATE links SET url = ?, title = ?, description = ?, priority_order = ? WHERE id = ?');

const deleteLink = db.prepare('DELETE FROM links WHERE id = ?');

const getLinkById = db.prepare('SELECT * FROM links WHERE id = ?');

const getLinkCount = db.prepare('SELECT COUNT(*) as count FROM links');

const getPendingCount = db.prepare("SELECT COUNT(*) as count FROM links WHERE status = 'pending'");

// ─── Members ─────────────────────────────────────────────────────
const addMember = db.prepare(`
  INSERT OR IGNORE INTO members (telegram_id, username, first_name, last_name)
  VALUES (?, ?, ?, ?)
`);

const getMember = db.prepare('SELECT * FROM members WHERE telegram_id = ?');

const getAllMembers = db.prepare(`
  SELECT m.*, (SELECT COUNT(*) FROM click_tracking WHERE member_telegram_id = m.telegram_id) as total_clicks
  FROM members m
  WHERE m.is_active = 1
  ORDER BY m.joined_at ASC
`);

const getActiveCount = db.prepare('SELECT COUNT(*) as count FROM members WHERE is_active = 1');

const deactivateMember = db.prepare('UPDATE members SET is_active = 0 WHERE telegram_id = ?');

const reactivateMember = db.prepare('UPDATE members SET is_active = 1 WHERE telegram_id = ?');

const incrementClicks = db.prepare(`
  UPDATE members SET total_clicks = total_clicks + 1, last_click_at = CURRENT_TIMESTAMP
  WHERE telegram_id = ?
`);

// ─── Click Tracking ──────────────────────────────────────────────
const addClick = db.prepare(`
  INSERT INTO click_tracking (link_id, member_telegram_id, user_agent)
  VALUES (?, ?, ?)
`);

const getClicksForLink = db.prepare(`
  SELECT ct.*, m.username, m.first_name
  FROM click_tracking ct
  LEFT JOIN members m ON ct.member_telegram_id = m.telegram_id
  WHERE ct.link_id = ?
  ORDER BY ct.clicked_at ASC
`);

const getClickCountForLink = db.prepare('SELECT COUNT(DISTINCT member_telegram_id) as count FROM click_tracking WHERE link_id = ?');

const getTodayClicks = db.prepare(`
  SELECT ct.*, m.username, m.first_name, l.url, l.title
  FROM click_tracking ct
  LEFT JOIN members m ON ct.member_telegram_id = m.telegram_id
  LEFT JOIN links l ON ct.link_id = l.id
  WHERE DATE(ct.clicked_at, '+8 hours') = DATE('now', '+8 hours')
  ORDER BY ct.clicked_at DESC
`);

const getMemberClickedToday = db.prepare(`
  SELECT DISTINCT ct.member_telegram_id
  FROM click_tracking ct
  JOIN members m ON ct.member_telegram_id = m.telegram_id
  WHERE DATE(ct.clicked_at, '+8 hours') = DATE('now', '+8 hours')
`);

const hasClickedLink = db.prepare(`
  SELECT COUNT(*) as count FROM click_tracking
  WHERE link_id = ? AND member_telegram_id = ?
`);

// ─── Non-Clickers ────────────────────────────────────────────────
const getNonClickersToday = db.prepare(`
  SELECT m.* FROM members m
  WHERE m.is_active = 1
  AND m.telegram_id NOT IN (
    SELECT DISTINCT ct.member_telegram_id
    FROM click_tracking ct
    WHERE DATE(ct.clicked_at, '+8 hours') = DATE('now', '+8 hours')
  )
  ORDER BY m.first_name ASC
`);

// ─── Blast History ───────────────────────────────────────────────
const addBlastRecord = db.prepare(`
  INSERT INTO blast_history (blast_date, link_id, message_id)
  VALUES (?, ?, ?)
`);

const getTodayBlasts = db.prepare(`
  SELECT bh.*, l.url, l.title
  FROM blast_history bh
  LEFT JOIN links l ON bh.link_id = l.id
  WHERE bh.blast_date = DATE('now', '+8 hours')
  ORDER BY bh.sent_at ASC
`);

const getBlastHistory = db.prepare(`
  SELECT bh.blast_date, COUNT(*) as link_count,
    SUM(CASE WHEN EXISTS (
      SELECT 1 FROM click_tracking ct WHERE ct.link_id = bh.link_id
    ) THEN 1 ELSE 0 END) as clicked_count
  FROM blast_history bh
  GROUP BY bh.blast_date
  ORDER BY bh.blast_date DESC
  LIMIT ?
`);

// ─── Stats ───────────────────────────────────────────────────────
const getDailyStats = db.prepare(`
  SELECT
    DATE(ct.clicked_at) as date,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT ct.member_telegram_id) as unique_clickers,
    COUNT(DISTINCT ct.link_id) as links_clicked
  FROM click_tracking ct
  WHERE ct.clicked_at >= DATE('now', '-30 days')
  GROUP BY DATE(ct.clicked_at)
  ORDER BY date DESC
`);

module.exports = {
  db,
  // Settings
  getSetting: (key) => {
    const row = getSetting.get(key);
    return row ? row.value : null;
  },
  setSetting: (key, value) => setSetting.run(key, String(value)),
  // Links
  addLink: (url, title = '', description = '', priority = null, submittedBy = 'admin', submittedById = '') => {
    const order = priority || getNextPriority.get().next;
    return addLink.run(url, title, description, order, submittedBy, submittedById);
  },
  getAllLinks: () => getAllLinks.all(),
  getPendingLinks: (limit = 10) => getPendingLinks.all(limit),
  updateLinkStatus: (id, status) => updateLinkStatus.run(status, id),
  updateLink: (id, url, title, description, priority) => updateLink.run(url, title, description, priority, id),
  deleteLink: (id) => deleteLink.run(id),
  deleteAllLinks: () => db.prepare('DELETE FROM links').run(),
  cutQueueLink: (id) => {
    const transaction = db.transaction(() => {
      // Find the current minimum priority among pending links
      const minPending = db.prepare("SELECT MIN(priority_order) as minP FROM links WHERE status = 'pending'").get().minP;
      if (minPending === null) return;

      // Shift all pending links down by 1
      db.prepare("UPDATE links SET priority_order = priority_order + 1 WHERE status = 'pending'").run();

      // Set the target link to the original minimum pending priority
      db.prepare('UPDATE links SET priority_order = ? WHERE id = ?').run(minPending, id);
    });
    return transaction();
  },
  getLinkById: (id) => getLinkById.get(id),
  getLinkCount: () => getLinkCount.get().count,
  getPendingCount: () => getPendingCount.get().count,
  // Members
  addMember: (telegramId, username, firstName, lastName) => addMember.run(String(telegramId), username || '', firstName || '', lastName || ''),
  getMember: (telegramId) => getMember.get(String(telegramId)),
  getAllMembers: () => getAllMembers.all(),
  getActiveCount: () => getActiveCount.get().count,
  deactivateMember: (telegramId) => deactivateMember.run(String(telegramId)),
  reactivateMember: (telegramId) => reactivateMember.run(String(telegramId)),
  incrementClicks: (telegramId) => incrementClicks.run(String(telegramId)),
  // Click Tracking
  addClick: (linkId, memberTelegramId, userAgent = '') => {
    addClick.run(linkId, String(memberTelegramId), userAgent);
    incrementClicks.run(String(memberTelegramId));
  },
  getClicksForLink: (linkId) => getClicksForLink.all(linkId),
  getClickCountForLink: (linkId) => getClickCountForLink.get(linkId).count,
  getTodayClicks: () => getTodayClicks.all(),
  getMemberClickedToday: () => getMemberClickedToday.all().map(r => r.member_telegram_id),
  hasClickedLink: (linkId, memberTelegramId) => hasClickedLink.get(linkId, String(memberTelegramId)).count > 0,
  getNonClickersToday: () => getNonClickersToday.all(),
  // Blast History
  addBlastRecord: (date, linkId, messageId = '') => addBlastRecord.run(date, linkId, messageId),
  getTodayBlasts: () => getTodayBlasts.all(),
  getBlastHistory: (limit = 30) => getBlastHistory.all(limit),
  // Stats
  getDailyStats: () => getDailyStats.all(),
};

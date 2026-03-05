// ─── API Helper ──────────────────────────────────────────────────
async function api(endpoint, options = {}) {
    try {
        const res = await fetch(`/api${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        // Handle Session Expiry / Unauthorized Access
        if (res.status === 401) {
            window.location.href = '/login.html';
            return { success: false, error: 'Session expired' };
        }

        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        return { success: false, error: err.message };
    }
}

async function logout() {
    if (!confirm('Adakah anda pasti mahu Log Out?')) return;
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (err) {
        window.location.href = '/login.html';
    }
}

// ─── Tab Navigation ──────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    // Load data for the tab
    switch (tabName) {
        case 'links': loadLinks(); break;
        case 'members': loadMembers(); break;
        case 'analytics': loadAnalytics(); break;
        case 'settings': loadSettings(); break;
    }
}

// ─── Stats ───────────────────────────────────────────────────────
async function loadStats() {
    const overview = await api('/stats/overview');
    const today = await api('/stats/today');

    if (overview.success) {
        document.getElementById('statPending').textContent = overview.data.pending_links;
        document.getElementById('statMembers').innerHTML = `${overview.data.total_members}<small>/${overview.data.max_members}</small>`;
    }

    if (today.success) {
        document.getElementById('statClicks').textContent = today.data.total_clicks;
        document.getElementById('statClickRate').textContent = `${today.data.click_rate}%`;
    }
}

// ─── Links ───────────────────────────────────────────────────────
async function loadLinks() {
    const result = await api('/links');
    const pendingBody = document.getElementById('pendingBody');
    const blastedBody = document.getElementById('blastedBody');

    if (!result.success) {
        pendingBody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading links</td></tr>';
        blastedBody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading links</td></tr>';
        return;
    }

    const pendingLinks = result.data.filter(l => l.status === 'pending');
    const blastedLinks = result.data.filter(l => l.status === 'blasted');

    // Render Pending
    if (pendingLinks.length === 0) {
        pendingBody.innerHTML = '<tr><td colspan="6" class="empty-state">No links yet. Click "+ Add Link" to get started.</td></tr>';
    } else {
        pendingBody.innerHTML = pendingLinks.map((link, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><div class="url-text" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</div></td>
                <td>${escapeHtml(link.title) || '—'}</td>
                <td><span class="badge badge-pending">pending</span></td>
                <td>${formatDate(link.created_at)}</td>
                <td>
                    <button class="btn btn-small btn-ghost" onclick="copyUrl('${escapeHtml(link.url)}')" title="Copy URL">📋</button>
                    <button class="btn btn-small btn-ghost" onclick="cutQueueLink(${link.id})" title="Cut Queue (Move to Top)">🔝</button>
                    <button class="btn btn-small btn-danger" onclick="deleteLink(${link.id})" title="Delete">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // Render Blasted
    if (blastedLinks.length === 0) {
        blastedBody.innerHTML = '<tr><td colspan="6" class="empty-state">No blasted links yet.</td></tr>';
    } else {
        blastedBody.innerHTML = blastedLinks.map((link, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><div class="url-text" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</div></td>
                <td>${escapeHtml(link.title) || '—'}</td>
                <td>${link.click_count || 0}</td>
                <td>${link.blasted_at ? formatDate(link.blasted_at) : '—'}</td>
                <td>
                    <button class="btn btn-small btn-ghost" onclick="copyUrl('${escapeHtml(link.url)}')" title="Copy URL">📋</button>
                    <button class="btn btn-small btn-danger" onclick="deleteLink(${link.id})" title="Delete">🗑️</button>
                </td>
            </tr>
        `).join('');
    }
}

async function cutQueueLink(id) {
    if (!confirm('Move this link to the top of the queue?')) return;
    const result = await api(`/links/${id}/cut`, { method: 'POST' });
    if (result.success) {
        showToast('Link moved to top! 🔝', 'success');
        loadLinks();
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
}

function showAddLink() {
    hideImport();
    document.getElementById('addLinkForm').classList.remove('hidden');
}

function hideAddLink() {
    document.getElementById('addLinkForm').classList.add('hidden');
    document.getElementById('linkUrl').value = '';
    document.getElementById('linkTitle').value = '';
}

// ─── Import Spreadsheet ───────────────────────────────────────────
let importRows = [];

function showImport() {
    hideAddLink();
    document.getElementById('importFile').value = '';
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('importCancelRow').classList.remove('hidden');
    document.getElementById('importForm').classList.remove('hidden');
    importRows = [];
}

function hideImport() {
    document.getElementById('importForm').classList.add('hidden');
    importRows = [];
}

function previewImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            // Find Name and Link columns (case-insensitive)
            importRows = rows.map(row => {
                const keys = Object.keys(row);
                // Look for "Nama :" or "Name :"
                const nameKey = keys.find(k => /^(nama|name)\s*:?$/i.test(k.trim()));
                // Look for "Link CutPriceTiktok :" or "Link" or "URL"
                const linkKey = keys.find(k => /^(link|link\s*cutpricetiktok\s*:?|url)$/i.test(k.trim()));

                return {
                    name: nameKey ? String(row[nameKey]).trim() : '',
                    url: linkKey ? String(row[linkKey]).trim() : ''
                };
            }).filter(r => r.name && r.url);

            if (importRows.length === 0) {
                showToast('No valid rows found. Make sure columns are named "Nama :" and "Link CutPriceTiktok :".', 'error');
                return;
            }

            // Show preview table
            document.getElementById('importCount').textContent = importRows.length;
            document.getElementById('importCancelRow').classList.add('hidden');
            document.getElementById('importPreviewBody').innerHTML = importRows.map((r, i) => `
                <tr id="importRow${i}">
                    <td>${i + 1}</td>
                    <td>${escapeHtml(r.name)}</td>
                    <td><div class="url-text" title="${escapeHtml(r.url)}">${escapeHtml(r.url)}</div></td>
                    <td><span class="badge badge-pending">Pending</span></td>
                </tr>
            `).join('');
            document.getElementById('importPreview').classList.remove('hidden');
        } catch (err) {
            showToast('Error reading file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function doImport() {
    if (importRows.length === 0) return;

    const btn = document.getElementById('importBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Importing...';

    let success = 0, failed = 0;

    for (let i = 0; i < importRows.length; i++) {
        const row = importRows[i];
        const rowEl = document.getElementById(`importRow${i}`);
        const statusCell = rowEl ? rowEl.querySelector('td:last-child') : null;

        try {
            const result = await api('/links', {
                method: 'POST',
                body: { url: row.url, title: row.name, description: '', priority_order: null }
            });
            if (result.success) {
                success++;
                if (statusCell) statusCell.innerHTML = '<span class="badge badge-success">✅ Imported</span>';
            } else {
                failed++;
                if (statusCell) statusCell.innerHTML = '<span class="badge badge-danger">❌ Failed</span>';
            }
        } catch {
            failed++;
            if (statusCell) statusCell.innerHTML = '<span class="badge badge-danger">❌ Error</span>';
        }

        // Small delay to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 100));
    }

    btn.textContent = `✅ Done (${success} imported, ${failed} failed)`;
    showToast(`Import complete! ${success} links added.`, 'success');
    loadLinks();
    loadStats();
    importRows = [];
}

async function addLink() {
    const url = document.getElementById('linkUrl').value.trim();
    const title = document.getElementById('linkTitle').value.trim();

    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    if (!title) {
        showToast('Please enter a title', 'error');
        return;
    }

    const result = await api('/links', {
        method: 'POST',
        body: { url, title, description: '', priority_order: null }
    });

    if (result.success) {
        showToast('Link added successfully! ✅', 'success');
        hideAddLink();
        loadLinks();
        loadStats();
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
}

async function deleteLink(id) {
    if (!confirm('Are you sure you want to delete this link?')) return;

    const result = await api(`/links/${id}`, { method: 'DELETE' });
    if (result.success) {
        showToast('Link deleted', 'success');
        loadLinks();
        loadStats();
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
}

async function deleteAllLinks() {
    if (!confirm('⚠️ Are you sure you want to REMOVE ALL LINKS from the list? This cannot be undone.')) return;

    const result = await api('/links/all', { method: 'DELETE' });
    if (result.success) {
        showToast('All links removed! 🗑️', 'success');
        loadLinks();
        loadStats();
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
}

// ─── Members ─────────────────────────────────────────────────────
async function loadMembers() {
    const result = await api('/members');
    const tbody = document.getElementById('membersBody');
    const countEl = document.getElementById('memberCount');

    if (!result.success || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No members yet. Share the invite link to add members.</td></tr>';
        countEl.textContent = '0 members';
        return;
    }

    countEl.textContent = `${result.data.length} members`;

    tbody.innerHTML = result.data.map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(m.first_name || '—')} ${escapeHtml(m.last_name || '')}</td>
      <td>${m.username ? `@${escapeHtml(m.username)}` : '—'}</td>
      <td>${formatDate(m.joined_at)}</td>
      <td>${m.total_clicks}</td>
      <td>${m.last_click_at ? formatDate(m.last_click_at) : 'Never'}</td>
      <td><span class="badge ${m.is_active ? 'badge-success' : 'badge-danger'}">${m.is_active ? 'Active' : 'Left'}</span></td>
    </tr>
  `).join('');
}

// ─── Analytics ───────────────────────────────────────────────────
async function loadAnalytics() {
    await Promise.all([loadNonClickers(), loadBlastHistory(), loadDailyChart()]);
}

async function loadNonClickers() {
    const result = await api('/stats/non-clickers');
    const tbody = document.getElementById('nonClickersBody');
    const countEl = document.getElementById('nonClickerCount');

    if (!result.success || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">✅ All members clicked today (or no blasts sent).</td></tr>';
        countEl.textContent = '0';
        return;
    }

    countEl.textContent = result.data.length;

    tbody.innerHTML = result.data.map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(m.first_name || '—')} ${escapeHtml(m.last_name || '')}</td>
      <td>${m.username ? `@${escapeHtml(m.username)}` : '—'}</td>
      <td><code>${m.telegram_id}</code></td>
      <td>${m.total_clicks}</td>
    </tr>
  `).join('');
}

async function loadBlastHistory() {
    const result = await api('/blast/history');
    const tbody = document.getElementById('blastHistoryBody');

    if (!result.success || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No blast history yet.</td></tr>';
        return;
    }

    tbody.innerHTML = result.data.map(b => {
        const rate = b.total_members_at_time > 0 ? Math.round((b.unique_clickers / b.total_members_at_time) * 100) : 0;
        return `
      <tr>
        <td>${b.blast_date}</td>
        <td>${b.link_count}</td>
        <td>${b.unique_clickers} / ${b.total_members_at_time}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
              <div style="width:${rate}%;height:100%;background:var(--gradient-4);border-radius:3px"></div>
            </div>
            <span style="font-size:13px;font-weight:600">${rate}%</span>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

async function loadDailyChart() {
    const result = await api('/stats/daily');
    const container = document.getElementById('chartBars');

    if (!result.success || result.data.length === 0) {
        container.innerHTML = '<div class="empty-state" style="width:100%;text-align:center">No data yet</div>';
        return;
    }

    const maxClicks = Math.max(...result.data.map(d => d.total_clicks), 1);
    const total30Days = result.data.reduce((acc, d) => acc + d.total_clicks, 0);

    // Add total clicks badge to the header if not exists
    const cardHeader = container.closest('.card').querySelector('.card-header');
    let badge = cardHeader.querySelector('.total-30-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge total-30-badge';
        badge.style.background = 'var(--gradient-1)';
        badge.style.color = 'white';
        cardHeader.appendChild(badge);
    }
    badge.textContent = `${total30Days} Clicks (30d)`;

    container.innerHTML = result.data.reverse().map(d => {
        const height = Math.max((d.total_clicks / maxClicks) * 140, 4);
        const dayMonth = new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:30px;height:100%;justify-content:flex-end;gap:8px">
        <div class="chart-bar" style="height:${height}px;width:100%;max-width:24px" title="${d.date}">
          <div class="tooltip">${d.date}<br>${d.total_clicks} clicks, ${d.unique_clickers} users</div>
        </div>
        <span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${dayMonth}</span>
      </div>
    `;
    }).join('');
}

// ─── Settings ────────────────────────────────────────────────────
async function loadSettings() {
    const result = await api('/settings');
    if (!result.success) return;

    const s = result.data;
    document.getElementById('settGroupStatus').textContent = s.group_id !== 'Not configured' ? '✅ Configured' : '❌ Not configured';
    document.getElementById('settGroupId').textContent = s.group_id;
    document.getElementById('settBlastTime').value = s.blast_time;
    document.getElementById('settLinksPerBlast').value = s.links_per_blast;
    document.getElementById('settMaxMembers').value = s.max_members;
    document.getElementById('settPublicUrl').textContent = s.public_url;



    const linkEl = document.getElementById('settInviteLink');
    linkEl.textContent = s.invite_link;
    if (s.invite_link !== 'Not generated yet') {
        linkEl.href = s.invite_link;
    }
}



async function saveBlastSettings() {
    const blast_time = document.getElementById('settBlastTime').value;
    const links_per_blast = parseInt(document.getElementById('settLinksPerBlast').value);
    const max_members = parseInt(document.getElementById('settMaxMembers').value);

    if (!blast_time) { showToast('Please enter a valid blast time', 'error'); return; }
    if (!links_per_blast || links_per_blast < 1) { showToast('Links per blast must be at least 1', 'error'); return; }
    if (!max_members || max_members < 1) { showToast('Max members must be at least 1', 'error'); return; }

    const result = await api('/settings', {
        method: 'POST',
        body: { blast_time, links_per_blast, max_members }
    });

    if (result.success) {
        showToast('✅ Settings saved! Restart server to apply blast time changes.', 'success');
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
}

function copyInviteLink() {
    const link = document.getElementById('settInviteLink').textContent;
    if (link === 'Not generated yet') {
        showToast('Invite link not generated yet', 'error');
        return;
    }
    navigator.clipboard.writeText(link);
    showToast('Invite link copied! 📋', 'success');
}

// ─── Blast Trigger ───────────────────────────────────────────────
async function triggerBlast() {
    const btn = document.getElementById('btnBlast');
    btn.disabled = true;
    btn.textContent = '⏳ Blasting...';

    const result = await api('/blast/trigger', { method: 'POST' });

    btn.disabled = false;
    btn.textContent = '🚀 Blast Now';

    if (result.success) {
        showToast(result.message || 'Blast sent! ✅', 'success');
        loadStats();
        loadLinks();
    } else {
        showToast(`Error: ${result.error || result.message}`, 'error');
    }
}

// ─── Helpers ─────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyUrl(url) {
    navigator.clipboard.writeText(url);
    showToast('URL copied! 📋', 'success');
}

// ─── Toast Notifications ─────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ─── Auto-refresh ────────────────────────────────────────────────
function startAutoRefresh() {
    loadStats();
    loadLinks();

    // Refresh stats every 30 seconds
    setInterval(loadStats, 30000);
}

// ─── Initialize ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    startAutoRefresh();
});

// GitHub-based frontend for dashboard management
class GitHubDashboard {
  constructor() {
    this.apiBase = `https://api.github.com/repos/${this.getRepoOwner()}/${this.getRepoName()}`;
    this.dataFile = 'data.json';
  }

  getRepoOwner() {
    // Extract from current URL or use config
    return window.location.hostname === 'localhost' ? 'Kharrley9' : window.location.pathname.split('/')[1];
  }

  getRepoName() {
    return 'CutPriceTiktokBlastingSystem';
  }

  async fetchData() {
    try {
      const response = await fetch(`${this.apiBase}/contents/${this.dataFile}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      const content = atob(data.content);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error fetching data:', error);
      return {
        links: [],
        members: [],
        clickTracking: [],
        blastHistory: [],
        settings: {}
      };
    }
  }

  async updateData(updates, token) {
    if (!token) {
      throw new Error('GitHub token required for updates');
    }

    const currentData = await this.fetchData();
    const updatedData = { ...currentData, ...updates };

    try {
      // Get current file info
      const currentFile = await fetch(`${this.apiBase}/contents/${this.dataFile}`).then(r => r.json());
      
      const content = btoa(JSON.stringify(updatedData, null, 2));
      const message = 'Update dashboard data';
      
      const response = await fetch(`${this.apiBase}/contents/${this.dataFile}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content,
          sha: currentFile.sha
        })
      });

      if (!response.ok) throw new Error('Failed to update data');
      return await response.json();
    } catch (error) {
      console.error('Error updating data:', error);
      throw error;
    }
  }

  // Dashboard methods
  async getStats() {
    const data = await this.fetchData();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
    
    const todayClicks = data.clickTracking.filter(click => {
      const clickDate = new Date(click.clicked_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
      return clickDate === today;
    });

    const todayBlasts = data.blastHistory.filter(blast => blast.blast_date === today);

    return {
      totalLinks: data.links.length,
      pendingLinks: data.links.filter(l => l.status === 'pending').length,
      totalMembers: data.members.filter(m => m.is_active === 1).length,
      todayClicks: todayClicks.length,
      todayBlasts: todayBlasts.length,
      todayClickers: new Set(todayClicks.map(c => c.member_telegram_id)).size
    };
  }

  async getLinks() {
    const data = await this.fetchData();
    return data.links.map(link => ({
      ...link,
      click_count: data.clickTracking.filter(click => click.link_id === link.id).length
    }));
  }

  async addLink(linkData, token) {
    const data = await this.fetchData();
    const newLink = {
      id: Date.now(),
      ...linkData,
      status: 'pending',
      submitted_by: 'dashboard',
      submitted_by_id: '',
      is_priority_requested: 0,
      priority_approved: 0,
      created_at: new Date().toISOString(),
      blasted_at: null
    };

    data.links.push(newLink);
    await this.updateData(data, token);
    return newLink;
  }

  async deleteLink(linkId, token) {
    const data = await this.fetchData();
    data.links = data.links.filter(l => l.id !== parseInt(linkId));
    await this.updateData(data, token);
  }

  async getMembers() {
    const data = await this.fetchData();
    return data.members
      .filter(member => member.is_active === 1)
      .map(member => ({
        ...member,
        total_clicks: data.clickTracking.filter(click => click.member_telegram_id === member.telegram_id).length
      }));
  }

  async getTodayClicks() {
    const data = await this.fetchData();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
    
    return data.clickTracking
      .filter(click => {
        const clickDate = new Date(click.clicked_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        return clickDate === today;
      })
      .map(click => {
        const member = data.members.find(m => m.telegram_id === click.member_telegram_id);
        const link = data.links.find(l => l.id === click.link_id);
        return {
          ...click,
          username: member?.username || '',
          first_name: member?.first_name || '',
          url: link?.url || '',
          title: link?.title || ''
        };
      });
  }

  async getDailyStats() {
    const data = await this.fetchData();
    const stats = {};
    
    data.clickTracking.forEach(click => {
      const date = new Date(click.clicked_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
      if (!stats[date]) {
        stats[date] = {
          total_clicks: 0,
          unique_clickers: new Set(),
          links_clicked: new Set()
        };
      }
      stats[date].total_clicks++;
      stats[date].unique_clickers.add(click.member_telegram_id);
      stats[date].links_clicked.add(click.link_id);
    });
    
    return Object.entries(stats)
      .map(([date, stat]) => ({
        date,
        total_clicks: stat.total_clicks,
        unique_clickers: stat.unique_clickers.size,
        links_clicked: stat.links_clicked.size
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);
  }
}

// Initialize dashboard
window.dashboard = new GitHubDashboard();

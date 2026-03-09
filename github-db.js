const { Octokit } = require('@octokit/rest');
const fs = require('fs');

class GitHubDatabase {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    this.owner = process.env.REPO_OWNER;
    this.repo = process.env.REPO_NAME;
    this.dataFile = 'data.json';
  }

  async loadData() {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: this.dataFile
      });
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Initialize with empty data structure
      return {
        links: [],
        members: [],
        clickTracking: [],
        blastHistory: [],
        settings: {}
      };
    }
  }

  async saveData(data) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    try {
      // Try to update existing file
      const { data: existingFile } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: this.dataFile
      });
      
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: this.dataFile,
        message: 'Update database',
        content: content,
        sha: existingFile.sha
      });
    } catch (error) {
      // Create new file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: this.dataFile,
        message: 'Initialize database',
        content: content
      });
    }
  }

  // Settings methods
  async getSetting(key) {
    const data = await this.loadData();
    return data.settings[key] || null;
  }

  async setSetting(key, value) {
    const data = await this.loadData();
    data.settings[key] = value;
    await this.saveData(data);
  }

  // Links methods
  async addLink(url, title = '', description = '', priority = null, submittedBy = 'admin', submittedById = '') {
    const data = await this.loadData();
    const link = {
      id: Date.now(),
      url,
      title,
      description,
      priority_order: priority || data.links.length + 1,
      status: 'pending',
      submitted_by: submittedBy,
      submitted_by_id: submittedById,
      is_priority_requested: 0,
      priority_approved: 0,
      created_at: new Date().toISOString(),
      blasted_at: null
    };
    data.links.push(link);
    await this.saveData(data);
    return link;
  }

  async getAllLinks() {
    const data = await this.loadData();
    return data.links.map(link => ({
      ...link,
      click_count: data.clickTracking.filter(click => click.link_id === link.id).length
    }));
  }

  async getPendingLinks(limit = 10) {
    const data = await this.loadData();
    return data.links
      .filter(link => link.status === 'pending')
      .sort((a, b) => {
        if (a.priority_approved !== b.priority_approved) {
          return b.priority_approved - a.priority_approved;
        }
        return new Date(a.priority_at || a.created_at) - new Date(b.priority_at || b.created_at);
      })
      .slice(0, limit);
  }

  async updateLinkStatus(id, status) {
    const data = await this.loadData();
    const link = data.links.find(l => l.id === parseInt(id));
    if (link) {
      link.status = status;
      link.blasted_at = status === 'blasted' ? new Date().toISOString() : null;
      await this.saveData(data);
    }
  }

  // Members methods
  async addMember(telegramId, username, firstName, lastName) {
    const data = await this.loadData();
    const existingMember = data.members.find(m => m.telegram_id === String(telegramId));
    
    if (!existingMember) {
      const member = {
        id: Date.now(),
        telegram_id: String(telegramId),
        username: username || '',
        first_name: firstName || '',
        last_name: lastName || '',
        joined_at: new Date().toISOString(),
        is_active: 1,
        total_clicks: 0,
        last_click_at: null
      };
      data.members.push(member);
      await this.saveData(data);
      return member;
    }
    return existingMember;
  }

  async getAllMembers() {
    const data = await this.loadData();
    return data.members
      .filter(member => member.is_active === 1)
      .map(member => ({
        ...member,
        total_clicks: data.clickTracking.filter(click => click.member_telegram_id === member.telegram_id).length
      }));
  }

  // Click tracking methods
  async addClick(linkId, memberTelegramId, userAgent = '') {
    const data = await this.loadData();
    const click = {
      id: Date.now(),
      link_id: parseInt(linkId),
      member_telegram_id: String(memberTelegramId),
      clicked_at: new Date().toISOString(),
      user_agent: userAgent
    };
    data.clickTracking.push(click);
    
    // Update member click count
    const member = data.members.find(m => m.telegram_id === String(memberTelegramId));
    if (member) {
      member.total_clicks++;
      member.last_click_at = new Date().toISOString();
    }
    
    await this.saveData(data);
  }

  async getTodayClicks() {
    const data = await this.loadData();
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

  // Stats methods
  async getDailyStats() {
    const data = await this.loadData();
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

module.exports = GitHubDatabase;

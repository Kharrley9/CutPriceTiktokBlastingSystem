// Migration tool: Export SQLite data to GitHub-compatible JSON format
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function exportSqliteToJson() {
  console.log('🔄 Exporting SQLite data to JSON format...');
  
  try {
    // Connect to existing SQLite database
    const dataDir = path.join(__dirname, 'data');
    const DB_PATH = path.join(dataDir, 'cutprice.db');
    
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ No SQLite database found at:', DB_PATH);
      console.log('💡 Make sure you have existing data before running this migration.');
      return;
    }
    
    const db = new Database(DB_PATH);
    
    // Export all data
    const exportData = {
      links: db.prepare('SELECT * FROM links').all(),
      members: db.prepare('SELECT * FROM members').all(),
      clickTracking: db.prepare('SELECT * FROM click_tracking').all(),
      blastHistory: db.prepare('SELECT * FROM blast_history').all(),
      settings: {}
    };
    
    // Export settings as key-value pairs
    const settings = db.prepare('SELECT * FROM settings').all();
    settings.forEach(setting => {
      exportData.settings[setting.key] = setting.value;
    });
    
    // Close database connection
    db.close();
    
    // Write to JSON file
    const outputPath = path.join(__dirname, 'data.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    
    console.log('✅ Export completed successfully!');
    console.log(`📁 Data saved to: ${outputPath}`);
    console.log(`📊 Exported: ${exportData.links.length} links, ${exportData.members.length} members, ${exportData.clickTracking.length} clicks`);
    
    // Show sample of exported data
    console.log('\n📋 Sample data:');
    console.log('Links:', exportData.links.length);
    console.log('Members:', exportData.members.length);
    console.log('Clicks:', exportData.clickTracking.length);
    console.log('Settings:', Object.keys(exportData.settings).length);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your SQLite database exists');
    console.log('2. Check file permissions');
    console.log('3. Ensure database is not locked by another process');
  }
}

// Run if called directly
if (require.main === module) {
  exportSqliteToJson();
}

module.exports = { exportSqliteToJson };

const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor(filePath = './database.db') {
        this.db = new Database(filePath);
        this.db.pragma('journal_mode = WAL'); // Enable write-ahead logging for better concurrency
        this.initializeTables();
    }

    initializeTables() {
        // Guild settings table (for prefix, etc.)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                prefix TEXT DEFAULT '?'
            )
        `);

        // Users table (for linked Discord accounts)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                DID TEXT PRIMARY KEY,
                agid TEXT NOT NULL,
                marks INTEGER DEFAULT 0,
                inventory TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // Guild Settings Methods
    getGuildPrefix(guildId) {
        try {
            const result = this.db.prepare('SELECT prefix FROM guild_settings WHERE guild_id = ?').get(guildId);
            return result ? result.prefix : null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting guild prefix:', err);
            return null;
        }
    }

    setGuildPrefix(guildId, prefix) {
        try {
            this.db.prepare('INSERT OR REPLACE INTO guild_settings (guild_id, prefix) VALUES (?, ?)').run(guildId, prefix);
        } catch (err) {
            const { error } = require('./Console');
            error('Error setting guild prefix:', err);
        }
    }

    deleteGuildPrefix(guildId) {
        try {
            this.db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
        } catch (err) {
            const { error } = require('./Console');
            error('Error deleting guild prefix:', err);
        }
    }

    // User Methods
    getUserByDiscordId(discordId) {
        try {
            const result = this.db.prepare('SELECT * FROM users WHERE DID = ?').get(discordId);
            return result;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting user:', err);
            return null;
        }
    }

    userExists(discordId) {
        try {
            const result = this.db.prepare('SELECT DID FROM users WHERE DID = ?').get(discordId);
            return !!result;
        } catch (err) {
            const { error } = require('./Console');
            error('Error checking user existence:', err);
            return false;
        }
    }

    createUser(discordId, agid, marks = 0, inventory = []) {
        try {
            const inventoryJson = JSON.stringify(inventory);
            this.db.prepare('INSERT INTO users (DID, agid, marks, inventory) VALUES (?, ?, ?, ?)').run(
                discordId,
                agid,
                marks,
                inventoryJson
            );
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error creating user:', err);
        }
    }

    updateUser(discordId, data) {
        try {
            const fields = [];
            const values = [];
            
            for (const [key, value] of Object.entries(data)) {
                if (key !== 'DID') {
                    fields.push(`${key} = ?`);
                    values.push(key === 'inventory' ? JSON.stringify(value) : value);
                }
            }

            if (fields.length === 0) return;

            values.push(discordId);
            const query = `UPDATE users SET ${fields.join(', ')} WHERE DID = ?`;
            this.db.prepare(query).run(...values);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error updating user:', err);
        }
    }

    getAllUsers() {
        try {
            const results = this.db.prepare('SELECT * FROM users').all();
            return results.map(user => ({
                ...user,
                inventory: JSON.parse(user.inventory || '[]')
            }));
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting all users:', err);
            return [];
        }
    }

    deleteUser(discordId) {
        try {
            this.db.prepare('DELETE FROM users WHERE DID = ?').run(discordId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error deleting user:', err);
        }
    }

    checkpointWAL() {
        try {
            this.db.pragma('wal_checkpoint(RESTART)');
        } catch (err) {
            const { error } = require('./Console');
            error('Error checkpointing WAL:', err);
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;

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

        // Web sessions table (for Discord OAuth2 sessions)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS web_sessions (
                session_id TEXT PRIMARY KEY,
                discord_id TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                username TEXT,
                discriminator TEXT,
                avatar TEXT,
                is_staff INTEGER DEFAULT 0,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Chat bridge messages log
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_bridge_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_id TEXT,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // Web Session Methods
    getWebSession(sessionId) {
        try {
            return this.db.prepare('SELECT * FROM web_sessions WHERE session_id = ?').get(sessionId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting web session:', err);
            return null;
        }
    }

    createWebSession(sessionId, data) {
        try {
            this.db.prepare(`
                INSERT OR REPLACE INTO web_sessions
                (session_id, discord_id, access_token, refresh_token, username, discriminator, avatar, is_staff, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sessionId,
                data.discord_id,
                data.access_token,
                data.refresh_token || null,
                data.username || null,
                data.discriminator || null,
                data.avatar || null,
                data.is_staff ? 1 : 0,
                data.expires_at || null
            );
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error creating web session:', err);
        }
    }

    deleteWebSession(sessionId) {
        try {
            this.db.prepare('DELETE FROM web_sessions WHERE session_id = ?').run(sessionId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error deleting web session:', err);
        }
    }

    // Chat Bridge Methods
    logBridgeMessage(source, authorName, authorId, content) {
        try {
            this.db.prepare(
                'INSERT INTO chat_bridge_messages (source, author_name, author_id, content) VALUES (?, ?, ?, ?)'
            ).run(source, authorName, authorId || null, content);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error logging bridge message:', err);
        }
    }

    getRecentBridgeMessages(limit = 50) {
        try {
            return this.db.prepare(
                'SELECT * FROM chat_bridge_messages ORDER BY timestamp DESC LIMIT ?'
            ).all(limit).reverse();
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting bridge messages:', err);
            return [];
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;

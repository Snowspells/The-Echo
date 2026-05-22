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

        // Staff roles table (maps Discord role IDs to staff levels)
        // Levels: 1 = Support, 2 = Moderator, 3 = Administrator
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS staff_roles (
                role_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                level INTEGER NOT NULL,
                label TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tickets table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                channel_id TEXT,
                creator_id TEXT NOT NULL,
                creator_name TEXT NOT NULL,
                subject TEXT DEFAULT 'No subject',
                status TEXT DEFAULT 'open',
                claimed_by TEXT,
                claimed_by_name TEXT,
                closed_by TEXT,
                closed_by_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME
            )
        `);

        // Ticket settings per guild
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ticket_settings (
                guild_id TEXT PRIMARY KEY,
                category_id TEXT,
                log_channel_id TEXT,
                support_role_id TEXT,
                welcome_message TEXT DEFAULT 'Thank you for creating a ticket! A staff member will be with you shortly.',
                ticket_count INTEGER DEFAULT 0
            )
        `);

        // Ticket transcripts
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ticket_transcripts (
                ticket_id INTEGER PRIMARY KEY,
                guild_id TEXT NOT NULL,
                transcript_html TEXT NOT NULL,
                message_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
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

        // Chat mutes table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_mutes (
                user_id TEXT PRIMARY KEY,
                muted_by TEXT NOT NULL,
                muted_by_name TEXT NOT NULL,
                reason TEXT,
                expires_at DATETIME,
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

    // Staff Role Methods
    // Levels: 1 = Support, 2 = Moderator, 3 = Administrator
    static STAFF_LEVELS = { SUPPORT: 1, MODERATOR: 2, ADMINISTRATOR: 3 };
    static STAFF_LABELS = { 1: 'Support', 2: 'Moderator', 3: 'Administrator' };

    setStaffRole(roleId, guildId, level) {
        try {
            const label = DatabaseManager.STAFF_LABELS[level];
            if (!label) return false;
            this.db.prepare(
                'INSERT OR REPLACE INTO staff_roles (role_id, guild_id, level, label) VALUES (?, ?, ?, ?)'
            ).run(roleId, guildId, level, label);
            this.checkpointWAL();
            return true;
        } catch (err) {
            const { error } = require('./Console');
            error('Error setting staff role:', err);
            return false;
        }
    }

    removeStaffRole(roleId) {
        try {
            this.db.prepare('DELETE FROM staff_roles WHERE role_id = ?').run(roleId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error removing staff role:', err);
        }
    }

    getStaffRole(roleId) {
        try {
            return this.db.prepare('SELECT * FROM staff_roles WHERE role_id = ?').get(roleId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting staff role:', err);
            return null;
        }
    }

    getAllStaffRoles(guildId) {
        try {
            if (guildId) {
                return this.db.prepare('SELECT * FROM staff_roles WHERE guild_id = ? ORDER BY level DESC').all(guildId);
            }
            return this.db.prepare('SELECT * FROM staff_roles ORDER BY level DESC').all();
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting all staff roles:', err);
            return [];
        }
    }

    getStaffLevelForRoles(roleIds) {
        try {
            if (!roleIds || roleIds.length === 0) return 0;
            const placeholders = roleIds.map(() => '?').join(',');
            const result = this.db.prepare(
                `SELECT MAX(level) as max_level FROM staff_roles WHERE role_id IN (${placeholders})`
            ).get(...roleIds);
            return result?.max_level || 0;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting staff level for roles:', err);
            return 0;
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

    // Ticket Settings Methods
    getTicketSettings(guildId) {
        try {
            return this.db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting ticket settings:', err);
            return null;
        }
    }

    setTicketSettings(guildId, data) {
        try {
            const existing = this.getTicketSettings(guildId);
            if (existing) {
                const fields = [];
                const values = [];
                for (const [key, value] of Object.entries(data)) {
                    if (key !== 'guild_id') {
                        fields.push(`${key} = ?`);
                        values.push(value);
                    }
                }
                if (fields.length === 0) return;
                values.push(guildId);
                this.db.prepare(`UPDATE ticket_settings SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
            } else {
                this.db.prepare(
                    'INSERT INTO ticket_settings (guild_id, category_id, log_channel_id, support_role_id, welcome_message) VALUES (?, ?, ?, ?, ?)'
                ).run(guildId, data.category_id || null, data.log_channel_id || null, data.support_role_id || null, data.welcome_message || 'Thank you for creating a ticket! A staff member will be with you shortly.');
            }
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error setting ticket settings:', err);
        }
    }

    incrementTicketCount(guildId) {
        try {
            const settings = this.getTicketSettings(guildId);
            const newCount = (settings?.ticket_count || 0) + 1;
            if (settings) {
                this.db.prepare('UPDATE ticket_settings SET ticket_count = ? WHERE guild_id = ?').run(newCount, guildId);
            } else {
                this.db.prepare('INSERT INTO ticket_settings (guild_id, ticket_count) VALUES (?, ?)').run(guildId, newCount);
            }
            this.checkpointWAL();
            return newCount;
        } catch (err) {
            const { error } = require('./Console');
            error('Error incrementing ticket count:', err);
            return 0;
        }
    }

    // Ticket Methods
    createTicket(guildId, channelId, creatorId, creatorName, subject) {
        try {
            const result = this.db.prepare(
                'INSERT INTO tickets (guild_id, channel_id, creator_id, creator_name, subject) VALUES (?, ?, ?, ?, ?)'
            ).run(guildId, channelId, creatorId, creatorName, subject || 'No subject');
            this.checkpointWAL();
            return result.lastInsertRowid;
        } catch (err) {
            const { error } = require('./Console');
            error('Error creating ticket:', err);
            return null;
        }
    }

    getTicket(ticketId) {
        try {
            return this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting ticket:', err);
            return null;
        }
    }

    getTicketByChannelId(channelId) {
        try {
            return this.db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND status = ?').get(channelId, 'open') || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting ticket by channel:', err);
            return null;
        }
    }

    getTicketsByGuild(guildId, status = null) {
        try {
            if (status) {
                return this.db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY created_at DESC').all(guildId, status);
            }
            return this.db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting tickets by guild:', err);
            return [];
        }
    }

    getTicketsByUser(creatorId) {
        try {
            return this.db.prepare('SELECT * FROM tickets WHERE creator_id = ? ORDER BY created_at DESC').all(creatorId);
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting tickets by user:', err);
            return [];
        }
    }

    getAllTickets(limit = 100) {
        try {
            return this.db.prepare('SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?').all(limit);
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting all tickets:', err);
            return [];
        }
    }

    updateTicket(ticketId, data) {
        try {
            const fields = [];
            const values = [];
            for (const [key, value] of Object.entries(data)) {
                if (key !== 'id') {
                    fields.push(`${key} = ?`);
                    values.push(value);
                }
            }
            if (fields.length === 0) return;
            values.push(ticketId);
            this.db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error updating ticket:', err);
        }
    }

    closeTicket(ticketId, closedBy, closedByName) {
        try {
            this.db.prepare(
                'UPDATE tickets SET status = ?, closed_by = ?, closed_by_name = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run('closed', closedBy, closedByName, ticketId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error closing ticket:', err);
        }
    }

    // Transcript Methods
    saveTranscript(ticketId, guildId, transcriptHtml, messageCount) {
        try {
            this.db.prepare(
                'INSERT OR REPLACE INTO ticket_transcripts (ticket_id, guild_id, transcript_html, message_count) VALUES (?, ?, ?, ?)'
            ).run(ticketId, guildId, transcriptHtml, messageCount);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error saving transcript:', err);
        }
    }

    getTranscript(ticketId) {
        try {
            return this.db.prepare('SELECT * FROM ticket_transcripts WHERE ticket_id = ?').get(ticketId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting transcript:', err);
            return null;
        }
    }

    getTranscriptsByGuild(guildId) {
        try {
            return this.db.prepare(
                `SELECT t.*, tk.creator_name, tk.subject, tk.status, tk.created_at as ticket_created, tk.closed_at
                 FROM ticket_transcripts t
                 JOIN tickets tk ON t.ticket_id = tk.id
                 WHERE t.guild_id = ?
                 ORDER BY t.created_at DESC`
            ).all(guildId);
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting transcripts by guild:', err);
            return [];
        }
    }

    getTicketStats(guildId) {
        try {
            const total = this.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?').get(guildId)?.count || 0;
            const open = this.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'open')?.count || 0;
            const closed = this.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'closed')?.count || 0;
            return { total, open, closed };
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting ticket stats:', err);
            return { total: 0, open: 0, closed: 0 };
        }
    }

    // Chat Mute Methods
    setChatMute(userId, mutedBy, mutedByName, reason, expiresAt) {
        try {
            this.db.prepare(
                'INSERT OR REPLACE INTO chat_mutes (user_id, muted_by, muted_by_name, reason, expires_at) VALUES (?, ?, ?, ?, ?)'
            ).run(userId, mutedBy, mutedByName, reason || null, expiresAt || null);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error setting chat mute:', err);
        }
    }

    getChatMute(userId) {
        try {
            return this.db.prepare('SELECT * FROM chat_mutes WHERE user_id = ?').get(userId) || null;
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting chat mute:', err);
            return null;
        }
    }

    removeChatMute(userId) {
        try {
            this.db.prepare('DELETE FROM chat_mutes WHERE user_id = ?').run(userId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error removing chat mute:', err);
        }
    }

    getAllChatMutes() {
        try {
            return this.db.prepare('SELECT * FROM chat_mutes ORDER BY created_at DESC').all();
        } catch (err) {
            const { error } = require('./Console');
            error('Error getting all chat mutes:', err);
            return [];
        }
    }

    deleteBridgeMessage(messageId) {
        try {
            this.db.prepare('DELETE FROM chat_bridge_messages WHERE id = ?').run(messageId);
            this.checkpointWAL();
        } catch (err) {
            const { error } = require('./Console');
            error('Error deleting bridge message:', err);
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;

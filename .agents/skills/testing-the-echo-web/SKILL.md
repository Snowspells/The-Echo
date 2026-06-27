---
name: testing-the-echo-web
description: How to test The Echo web server (Express + WebSocket) locally without a real Discord bot token.
---

# Testing The Echo Web Server

## Prerequisites

- Node.js 22+ (already available)
- `npm install` in repo root

## Setup

The Echo requires two files that are gitignored: `src/config.js` and `.env`. For testing, create minimal versions:

### 1. Create `src/config.js`

```js
module.exports = {
    users: { ownerId: 'TEST_OWNER_123', developers: [] },
    messages: {
        NOT_BOT_OWNER: 'Not the bot owner.',
        NOT_BOT_DEVELOPER: 'Not a developer.',
        NOT_GUILD_OWNER: 'Not the guild owner.',
        GUILD_COOLDOWN: 'Cooldown: %cooldown%s remaining.',
        MISSING_PERMISSIONS: 'Missing permissions.',
        CHANNEL_NOT_NSFW: 'Not NSFW channel.',
        COMPONENT_NOT_PUBLIC: 'Not public component.'
    },
    development: { enabled: false }
};
```

### 2. Set environment variables

```bash
export WEB_PORT=3099
export DISCORD_CLIENT_ID=TEST_CLIENT_ID_123
export DISCORD_CLIENT_SECRET=TEST_CLIENT_SECRET_456
export SESSION_SECRET=test-session-secret
export NODE_ENV=test
```

### 3. Create mock Discord client

The web server constructor requires a Discord client object. Use a mock:

```js
const DatabaseManager = require('./src/utils/Database');
const db = new DatabaseManager('./test-database.db');
const mockClient = {
    database: db,
    channels: { cache: { get: () => null } },
    guilds: { cache: { size: 0 } }
};

const WebServer = require('./src/web/server');
const webServer = new WebServer(mockClient);
await webServer.start();
```

## What to Test

### Database Layer
- `role_colors` table seeding (5 default rows, levels 0-4)
- `client_tokens` CRUD: createClientToken, getClientToken, deleteClientToken, deleteExpiredClientTokens
- `client_oauth_states`: createOAuthState, consumeOAuthState (single-use, 10-min expiry)
- `STAFF_LEVELS` includes OWNER=4, `STAFF_LABELS` includes 0='Member'

### Auth Middleware
- `requireAuth` with session user, Bearer token, unauthenticated browser (302), unauthenticated API (401 JSON)
- `requireStaff` with owner bypass, insufficient level (403 JSON)
- Token auth sets `req.session.user` for downstream handlers

### Client Auth API (`/auth/client/*`)
- `GET /login` returns `auth_url` + `state`, stores state in DB
- `POST /validate` with valid/invalid/expired/missing Bearer token
- `POST /logout` revokes token
- `GET /role-colors` returns 5 role colors
- `GET /callback` rejects missing/invalid state

### WebSocket Protocol (`/ws/chat`)
- Connect with `?token=<token>` — receives `history`, `role_colors`, `online_users`
- Rejects invalid/expired/no token with close code 4001
- `online_users` includes staffLevel, staffLabel, roleColor, source, agid
- Multiple connect/disconnect triggers online_users broadcasts

### Web Dashboard Compatibility
- `GET /` renders index page
- `GET /chat` redirects without auth, renders with auth
- Moderation endpoints work with both session and token auth

## Cleanup

After testing, remove:
- `src/config.js` (gitignored, don't commit)
- `test-database.db` and WAL/SHM files
- Any test harness scripts

## Known Limitations

- Full OAuth2 callback flow requires real Discord credentials
- Discord/Game relay features require real Discord bot connection
- The `expires_at` field uses JavaScript ISO format (`YYYY-MM-DDTHH:MM:SS.MMMZ`), not SQLite's `datetime()` format — use `new Date().toISOString()` for comparisons

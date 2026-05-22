# The Echo

A Discord bot and web dashboard for community management, account linking, and cross-platform chat bridging. Built on **discord.js v14** and **Express.js**.

*The Echo Beckons. The Echo Nurtures. The Echo Watches.*

## Features

### Discord Bot
- Full command handler supporting message commands, slash commands, user/message context menus.
- Component handling: buttons, select menus, modals, autocomplete.
- Advanced command options: cooldowns, permission checks, owner/developer restrictions.
- Per-guild configurable prefix.
- Account linking system (`/link`, `/adminlink`) to connect Discord users to game accounts (AGID).
- Staff role management (`/staffrole assign`, `/staffrole remove`, `/staffrole list`) with three tiers: Support, Moderator, Administrator.

### Web Dashboard
- **Discord OAuth2 Login** — Sign in with your Discord account.
- **User Dashboard** — View your linked game account, marks (currency), and inventory.
- **Staff Admin Panel** — Manage linked users, view bot stats, and monitor the chat bridge. Role-based access with three tiers: Support (read-only), Moderator (edit users), and Administrator (full access). Access is determined by Discord roles configured via the `/staffrole` command.

### Chat Bridge (Discord <-> Game)
- Bidirectional message relay between a Discord channel and the in-game "Global" chat.
- **REST API** for the game server to push messages into Discord (`POST /api/bridge/incoming`).
- **Outbound relay** automatically forwards Discord messages from the bridge channel to the game server via webhook.
- Message logging with history retrieval.
- Health check endpoint (`GET /api/bridge/health`).

## Dependencies
- **discord.js** — ^14.25.0
- **better-sqlite3** — ^9.2.2
- **express** — ^5.2.1
- **express-session** — ^1.19.0
- **ejs** — ^5.0.2
- **colors** — ^1.4.0
- **dotenv** — ^16.4.5

> [!NOTE]
> **Node.js v16.11.0** or newer is required.

## Setup

1. Clone or download this repository.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure the required files:
   - `src/example.config.js` -> `src/config.js` — Handler configuration (prefix, owner ID, developer IDs, etc.)
   - `.env.example` -> `.env` — Secrets and environment variables.

4. Fill in your `.env` file with the following values:

   ```env
   # Discord Bot
   CLIENT_TOKEN=your_discord_bot_token

   # Discord OAuth2 (for web dashboard)
   DISCORD_CLIENT_ID=your_discord_app_client_id
   DISCORD_CLIENT_SECRET=your_discord_app_client_secret
   WEB_BASE_URL=http://localhost:3000
   WEB_PORT=3000
   SESSION_SECRET=a_random_secret_string

   # Staff Roles (guild where staff roles are checked)
   STAFF_GUILD_ID=your_discord_guild_id

   # Chat Bridge
   BRIDGE_CHANNEL_ID=discord_channel_id_for_bridge
   BRIDGE_API_KEY=a_secret_key_for_game_server_api
   GAME_WEBHOOK_URL=http://your-game-server/api/chat
   
   # Logging
   LOG_LEVEL=info
   ```

5. Fill in `src/config.js` with your bot owner ID, developer IDs, and other settings.

6. Start the bot:
   ```bash
   npm start
   ```

   The Discord bot and web dashboard will start together. The web dashboard runs on the port specified by `WEB_PORT` (default: 3000).

> [!CAUTION]
> Never share your Discord bot token or client secret! Keep them in the `.env` file which is gitignored.

## Chat Bridge API

The game server communicates with The Echo via a REST API, authenticated with the `BRIDGE_API_KEY` header.

### Send a message from game to Discord
```
POST /api/bridge/incoming
Headers: X-API-Key: your_bridge_api_key
Body: { "playerName": "PlayerOne", "message": "Hello from the game!", "playerId": "optional-id" }
```

### Get recent bridge messages
```
GET /api/bridge/messages?limit=50
Headers: X-API-Key: your_bridge_api_key
```

### Health check
```
GET /api/bridge/health
```

### Get user data
```
GET /api/user/:discordId
Headers: X-API-Key: your_bridge_api_key
```

## Project Structure
```
src/
  index.js                     # Entry point
  config.js                    # Bot configuration (gitignored)
  client/
    DiscordBot.js              # Main bot client
    handler/                   # Command, component, and event handlers
  commands/
    Developer/                 # Eval, reload commands
    Information/               # Help command
    PoT/                       # Account linking commands (link, adminlink)
    Utility/                   # Ping, setprefix
  components/                  # Button, modal, select menu, autocomplete handlers
  events/
    Client/                    # Bot ready event
    ChatBridge/                # Discord -> Game message relay
  structure/                   # Base classes for commands, events, components
  utils/
    Console.js                 # Logging system with levels
    Database.js                # SQLite database manager
  web/
    server.js                  # Express web server
    middleware/
      auth.js                  # Authentication & staff authorization
    routes/
      auth.js                  # Discord OAuth2 login/callback/logout
      dashboard.js             # User dashboard
      admin.js                 # Staff admin panel
      api.js                   # Chat bridge & user REST API
    views/                     # EJS templates
    public/
      css/style.css            # Dark theme stylesheet
```

## Log Levels

See [LOG_LEVELS.md](./LOG_LEVELS.md) for details on configuring log verbosity.

## License
[**GPL-3.0**](./LICENSE), General Public License v3

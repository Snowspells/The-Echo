# Setup & Configuration

This guide walks through everything needed to get The Echo running.

## Prerequisites

- **Node.js** v16.11.0 or newer
- A **Discord Application** with a bot user ([Discord Developer Portal](https://discord.com/developers/applications))
- A Discord server where you have admin permissions

## 1. Install Dependencies

```bash
git clone https://github.com/Snowspells/The-Echo.git
cd The-Echo
npm install
```

## 2. Create the Config File

Copy the example config to create your own:

```bash
cp src/example.config.js src/config.js
```

Edit `src/config.js` with your values:

| Field | Description |
|-------|-------------|
| `commands.prefix` | Default message command prefix (e.g. `?`) |
| `commands.message_commands` | Enable/disable message commands (`true`/`false`) |
| `users.ownerId` | Your Discord user ID — gets full bot owner access |
| `users.developers` | Array of Discord user IDs — get developer-level access to restricted commands |
| `development.enabled` | If `true`, registers slash commands to a specific guild (faster updates during development) |
| `development.guildId` | The guild ID for development command registration |
| `messages.*` | Customizable error/permission messages |

> **Note:** `config.js` is gitignored and will not be committed to the repository.

## 3. Create the .env File

Create a `.env` file in the project root with the following variables:

```env
# ── Discord Bot ──────────────────────────────────────────
CLIENT_TOKEN=your_discord_bot_token

# ── Discord OAuth2 (Web Dashboard) ──────────────────────
DISCORD_CLIENT_ID=your_discord_application_client_id
DISCORD_CLIENT_SECRET=your_discord_application_client_secret
WEB_BASE_URL=http://localhost:3000
WEB_PORT=3000
SESSION_SECRET=any_random_string_for_session_encryption

# ── Staff Roles ─────────────────────────────────────────
STAFF_GUILD_ID=your_discord_server_id

# ── Chat Bridge ─────────────────────────────────────────
BRIDGE_CHANNEL_ID=discord_channel_id_for_chat_bridge
BRIDGE_API_KEY=a_secret_key_shared_with_your_game_server
GAME_WEBHOOK_URL=http://your-game-server.com/api/chat   # legacy fallback only

# ── Path of Titans (RCON + server webhook) ──────────────
RCON_HOST=your.server.ip
RCON_PORT=7779
RCON_PASSWORD=your_rcon_password
GAME_CHAT_CHANNEL_ID=discord_channel_the_pot_webhook_posts_to
# BRIDGE_RELAY_JOINS=true   # relay join/leave events to the bridge channel

# ── Logging ─────────────────────────────────────────────
LOG_LEVEL=info
```

### Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CLIENT_TOKEN` | Yes | Your Discord bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | For web | OAuth2 client ID (found in your Discord application's OAuth2 page) |
| `DISCORD_CLIENT_SECRET` | For web | OAuth2 client secret |
| `WEB_BASE_URL` | For web | The public URL of your web dashboard (e.g. `https://echo.example.com`) |
| `WEB_PORT` | No | Port for the web server (default: `3000`) |
| `SESSION_SECRET` | For web | Random string used to encrypt session cookies. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STAFF_GUILD_ID` | For staff | The Discord guild (server) ID where staff roles are checked during web login |
| `BRIDGE_CHANNEL_ID` | For bridge | The Discord channel ID that serves as the bridge endpoint |
| `BRIDGE_API_KEY` | For bridge | Shared secret key for authenticating game server API requests |
| `GAME_WEBHOOK_URL` | No | Legacy HTTP relay URL, used only when no RCON server is configured |
| `RCON_HOST` / `RCON_PORT` / `RCON_PASSWORD` | For PoT | Path of Titans RCON connection (see [Path of Titans Integration](Path-of-Titans-Integration.md)) |
| `GAME_CHAT_CHANNEL_ID` | For PoT inbound | Discord channel the PoT server webhook posts in-game chat/joins to |
| `LOG_LEVEL` | No | Logging verbosity: `error`, `warn`, `success`, `info`, or `debug` (default: `info`) |

## 4. Discord Application Setup

### Bot Permissions

When inviting the bot to your server, ensure it has these permissions:
- **Manage Channels** — Required for creating and deleting ticket channels
- **Send Messages** — Required for chat bridge, command responses, and ticket notifications
- **Read Message History** — Required for chat bridge channel and ticket transcript generation
- **View Channels** — Required to access the bridge channel and ticket channels
- **Embed Links** — Required for ticket panel embeds and log messages

### OAuth2 Configuration

In the [Discord Developer Portal](https://discord.com/developers/applications), go to your application's **OAuth2** page:

1. Under **Redirects**, add your callback URL:
   ```
   http://localhost:3000/auth/callback
   ```
   (Replace with your `WEB_BASE_URL` in production)

2. The bot uses these OAuth2 scopes:
   - `identify` — Read the user's Discord profile
   - `guilds.members.read` — Read the user's roles in the staff guild (for staff level detection)

### Bot Gateway Intents

In the Developer Portal under **Bot**, enable:
- **Message Content Intent** — Required for message commands and chat bridge relay

## 5. Start The Echo

```bash
npm start
```

Both the Discord bot and the web dashboard start together. You should see log output confirming:
- Bot login and command registration
- Web server listening on the configured port

## 6. First-Run Staff Setup

After the bot is online in your Discord server:

1. Use `/staffrole assign` to map your Discord roles to staff tiers (see [Staff System](Staff-System.md))
2. Open the web dashboard and log in with Discord
3. Navigate to the Staff Panel to verify your access level

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot won't start | Check that `CLIENT_TOKEN` is correct in `.env` and the bot is invited to at least one server |
| Web dashboard shows "Configuration Error" | Ensure `DISCORD_CLIENT_ID` is set in `.env` |
| OAuth2 callback fails | Verify the redirect URI in Discord Developer Portal matches `{WEB_BASE_URL}/auth/callback` exactly |
| Staff level not detected | Make sure `STAFF_GUILD_ID` is set and the user is a member of that guild. Users must re-login after role changes. |
| Chat bridge not relaying | Check that `BRIDGE_CHANNEL_ID` points to a valid channel the bot can read and send messages in |

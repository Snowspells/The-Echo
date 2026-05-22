# The Echo

*The Echo Beckons. The Echo Nurtures. The Echo Watches.*

**The Echo** is a community management platform for game server communities, combining a Discord bot, a web dashboard, and a cross-platform chat bridge into a single unified system. Built for communities where players interact both in-game and on Discord, The Echo bridges these worlds together.

## What It Does

- **Links Discord accounts to game identities** — Players connect their Discord ID to their in-game account (AGID), enabling cross-platform tracking of currency, inventory, and activity.
- **Ticketing system** — Private support channels in Discord with per-guild configuration, staff claiming, HTML transcript generation on close, and a web interface for browsing tickets and reading transcripts.
- **Web dashboard** — A companion website where players can view their linked account, browse tickets, and read transcripts by logging in with Discord.
- **Staff tools** — A tiered staff system (Support, Moderator, Administrator) driven by Discord roles, with a web admin panel for managing users, tickets, and monitoring activity.
- **Chat bridge** — Bidirectional message relay between a Discord channel and the in-game Global chat, so players stay connected whether they're in-game or on Discord.

## Quick Start

1. **Clone & install:**
   ```bash
   git clone https://github.com/Snowspells/The-Echo.git
   cd The-Echo
   npm install
   ```

2. **Configure:** Copy the example files and fill in your values:
   - `src/example.config.js` → `src/config.js`
   - Create a `.env` file (see [Setup & Configuration](wiki/Setup-and-Configuration.md))

3. **Run:**
   ```bash
   npm start
   ```
   The Discord bot and web dashboard start together.

## Documentation

Full documentation is available in the [wiki](wiki/Home.md):

- [Setup & Configuration](wiki/Setup-and-Configuration.md) — Environment variables, config file, and first-run setup.
- [Commands](wiki/Commands.md) — All Discord bot commands (slash commands, message commands, context menus).
- [Web Dashboard](wiki/Web-Dashboard.md) — Website layout, pages, and navigation.
- [Staff System](wiki/Staff-System.md) — Role-based access tiers and how to configure them.
- [Ticketing System](wiki/Ticketing-System.md) — Support tickets, transcript saving, and web viewer.
- [Chat Bridge](wiki/Chat-Bridge.md) — Discord ↔ Game chat relay setup and REST API reference.
- [Log Levels](LOG_LEVELS.md) — Configuring log verbosity.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Discord Bot | [discord.js](https://discord.js.org/) v14 |
| Database | [SQLite](https://www.sqlite.org/) via better-sqlite3 |
| Web Server | [Express.js](https://expressjs.com/) v5 |
| Templates | [EJS](https://ejs.co/) |
| Auth | Discord OAuth2 |

## Project Structure

```
src/
  index.js                     # Entry point — starts bot + web server
  config.js                    # Bot configuration (gitignored)
  client/                      # Discord bot client and handlers
  commands/
    Developer/                 # eval, reload (owner/developer only)
    Information/               # help
    PoT/                       # link, adminlink, staffrole
    Tickets/                   # ticket, ticketsetup
    Utility/                   # ping, setprefix
  components/                  # Button, modal, select menu, autocomplete handlers
  events/
    Client/                    # Bot ready event
    ChatBridge/                # Discord → Game message relay
  structure/                   # Base classes for commands, events, components
  utils/
    Console.js                 # Logging system with configurable levels
    Database.js                # SQLite database manager
  web/
    server.js                  # Express web server
    middleware/                # Auth & staff access middleware
    routes/                    # Auth, dashboard, admin, API routes
    views/                     # EJS templates (dark theme)
    public/                    # Static assets (CSS)
wiki/                          # Project documentation
```

## Contributing

Contributions are welcome. Please test your changes before submitting a pull request and follow the existing code style.

## License

[GPL-3.0](./LICENSE)

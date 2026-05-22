# The Echo — Wiki

Welcome to The Echo wiki. This documentation covers everything you need to set up, configure, and use The Echo for your game server community.

## Pages

### Getting Started
- **[Setup & Configuration](Setup-and-Configuration.md)** — Environment variables, config file, Discord application setup, and first-run instructions.

### Discord Bot
- **[Commands](Commands.md)** — Complete reference for all slash commands, message commands, and context menus.

### Web Dashboard
- **[Web Dashboard](Web-Dashboard.md)** — Website pages, layout, navigation, and how users interact with the site.

### Administration
- **[Staff System](Staff-System.md)** — Role-based access tiers (Support, Moderator, Administrator), how to configure them, and what each level can do.

### Support
- **[Ticketing System](Ticketing-System.md)** — Discord ticket channels, transcript generation, web-based transcript viewer, and setup guide.

### Game Integration
- **[Chat Bridge](Chat-Bridge.md)** — Bidirectional Discord ↔ Game chat relay, REST API reference, and game server integration guide.

---

## Overview

The Echo is a community management platform that connects three systems:

1. **Discord Bot** — Runs in your Discord server. Handles account linking, staff role management, ticketing, chat bridging, and utility commands.
2. **Web Dashboard** — A companion website where players log in with Discord to view their linked account, browse tickets, view transcripts, and where staff manage users and monitor activity.
3. **Ticketing System** — Private support channels in Discord with full transcript logging and a web interface for reviewing closed tickets.
4. **Chat Bridge** — A real-time message relay between a Discord channel and the in-game Global chat channel.

All four systems share a single SQLite database and run from a single Node.js process (`npm start`).

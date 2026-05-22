# Chat Bridge

The Echo provides a bidirectional chat bridge between a Discord channel and the in-game Global chat. Messages sent in either location are relayed to the other, keeping players connected whether they're in-game or on Discord.

## How It Works

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│          │  POST /api/bridge  │          │  Send to channel   │          │
│   Game   │ ──────────────────>│ The Echo │ ──────────────────>│ Discord  │
│  Server  │    /incoming       │   Bot    │                    │ Channel  │
│          │                    │          │                    │          │
│          │  GAME_WEBHOOK_URL  │          │  messageCreate     │          │
│          │ <──────────────────│          │ <──────────────────│          │
└──────────┘                    └──────────┘                    └──────────┘
```

### Game → Discord (Inbound)

1. A player sends a message in the game's Global chat
2. The game server sends a `POST` request to The Echo's API at `/api/bridge/incoming`
3. The Echo formats the message and sends it to the configured Discord channel
4. The message appears as: **[Global] PlayerName:** message content

### Discord → Game (Outbound)

1. A user sends a message in the bridge Discord channel
2. The Echo's `messageCreate` event listener detects the message
3. The bot sends a `POST` request to the game server's webhook URL (`GAME_WEBHOOK_URL`)
4. The game server receives the message and displays it in Global chat

Both directions are logged in the SQLite database for history and auditing.

---

## Configuration

### Required Environment Variables

```env
BRIDGE_CHANNEL_ID=1234567890123456789
BRIDGE_API_KEY=your_shared_secret_key
GAME_WEBHOOK_URL=http://your-game-server.com/api/chat
```

| Variable | Description |
|----------|-------------|
| `BRIDGE_CHANNEL_ID` | The Discord channel ID that serves as the bridge endpoint. Messages in this channel are relayed to the game. |
| `BRIDGE_API_KEY` | A shared secret key used to authenticate API requests from the game server. Choose a strong random string. |
| `GAME_WEBHOOK_URL` | The URL on your game server that accepts incoming chat messages from Discord. The Echo sends `POST` requests here. |

### How to find a Channel ID

1. In Discord, enable Developer Mode (**User Settings → Advanced → Developer Mode**)
2. Right-click the channel → **Copy Channel ID**

---

## REST API Reference

All API endpoints are served from the web server (default port 3000).

### Send a message from game to Discord

```http
POST /api/bridge/incoming
```

**Headers:**
| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-API-Key` | Your `BRIDGE_API_KEY` value |

**Request Body:**
```json
{
    "playerName": "PlayerOne",
    "message": "Hello from the game!",
    "playerId": "optional-player-id"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `playerName` | Yes | The in-game player's display name |
| `message` | Yes | The chat message content |
| `playerId` | No | Optional player identifier for logging |

**Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{ "status": "ok" }` | Message delivered to Discord |
| `400` | `{ "error": "Missing playerName or message" }` | Required fields missing |
| `401` | `{ "error": "Unauthorized" }` | Invalid or missing API key |
| `500` | `{ "error": "Bridge channel not configured" }` | `BRIDGE_CHANNEL_ID` not set |
| `500` | `{ "error": "Bridge channel not found" }` | Channel ID doesn't match a channel the bot can see |

**Example:**
```bash
curl -X POST http://localhost:3000/api/bridge/incoming \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"playerName": "TestPlayer", "message": "Hello from the game!"}'
```

---

### Get recent bridge messages

```http
GET /api/bridge/messages?limit=50
```

**Headers:**
| Header | Value |
|--------|-------|
| `X-API-Key` | Your `BRIDGE_API_KEY` value |

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `50` | Maximum number of messages to return |

**Response (200):**
```json
[
    {
        "id": 1,
        "source": "discord",
        "author_name": "Username",
        "author_id": "123456789",
        "content": "Hello from Discord!",
        "timestamp": "2025-01-15T12:00:00.000Z"
    },
    {
        "id": 2,
        "source": "game",
        "author_name": "PlayerOne",
        "author_id": "player-id",
        "content": "Hello from the game!",
        "timestamp": "2025-01-15T12:00:05.000Z"
    }
]
```

Messages are returned in chronological order (oldest first).

---

### Health check

```http
GET /api/bridge/health
```

No authentication required.

**Response (200):**
```json
{
    "status": "ok",
    "bot": "online",
    "uptime": 123456,
    "bridgeChannel": true
}
```

| Field | Description |
|-------|-------------|
| `status` | Always `"ok"` if the server is running |
| `bot` | `"online"` if the Discord bot is logged in, `"offline"` otherwise |
| `uptime` | Bot uptime in milliseconds (or `null` if offline) |
| `bridgeChannel` | `true` if `BRIDGE_CHANNEL_ID` is configured, `false` otherwise |

---

### Get user data

```http
GET /api/user/:discordId
```

**Headers:**
| Header | Value |
|--------|-------|
| `X-API-Key` | Your `BRIDGE_API_KEY` value |

**Response (200):**
```json
{
    "discordId": "123456789",
    "agid": "game-account-id",
    "marks": 100
}
```

**Response (404):**
```json
{
    "error": "User not found"
}
```

---

## Game Server Integration

### What your game server needs to implement

To complete the bridge, your game server needs:

1. **Send messages to Discord** — When a player sends a message in Global chat, make a `POST` request to `/api/bridge/incoming` with the player's name and message.

2. **Receive messages from Discord** — Set up an HTTP endpoint at your `GAME_WEBHOOK_URL` that accepts `POST` requests with this body:

```json
{
    "username": "DiscordUsername",
    "userId": "123456789",
    "message": "Hello from Discord!",
    "source": "discord"
}
```

Your game server should then display this message in the Global chat channel.

---

## Message Format

### In Discord (from game)
Messages from the game appear in Discord as:
```
[Global] PlayerName: message content
```

### In the game (from Discord)
The exact format depends on your game server's implementation. The Echo sends the raw username, user ID, message, and source identifier — your game server decides how to display it.

---

## Monitoring

The staff admin panel on the web dashboard includes a **Recent Chat Bridge Messages** section showing the last 25 bridged messages. Each entry shows:

- **Source** — Discord (blue) or Game (green)
- **Author** — The sender's name
- **Content** — The message text
- **Timestamp** — When the message was bridged

---

## Behavior Notes

- **Bot messages are ignored** — The bridge does not relay messages sent by bots in the Discord channel, preventing infinite relay loops.
- **Graceful degradation** — If `GAME_WEBHOOK_URL` is not configured, outbound relay (Discord → Game) is silently skipped. The bot logs this at debug level.
- **All messages are logged** — Both inbound and outbound messages are saved to the `chat_bridge_messages` SQLite table, regardless of whether delivery succeeds.

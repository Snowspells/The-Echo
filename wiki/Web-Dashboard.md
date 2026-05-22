# Web Dashboard

The Echo includes a companion website that runs alongside the Discord bot. Players log in with their Discord account to view their linked game data, and staff members access moderation tools through the admin panel.

## Accessing the Dashboard

The web dashboard starts automatically when you run `npm start`. By default it listens on port 3000:

```
http://localhost:3000
```

In production, set `WEB_BASE_URL` in your `.env` to match your domain (e.g. `https://echo.yourdomain.com`).

---

## Pages

### Home (`/`)

The landing page for The Echo. It displays:

- **The Echo tagline** and a brief description of what the platform does
- **Three feature cards:**
  - **Account Linking** — Link Discord to your in-game identity
  - **Global Chat Bridge** — Cross-platform chat between Discord and the game
  - **Community Hub** — Central place for stats and account management
- **Login button** — "Login with Discord" if not logged in, or "Go to Dashboard" if already authenticated

---

### Dashboard (`/dashboard`)

*Requires login.*

The user's personal page showing their linked account information.

**Profile Section:**
- Discord avatar (full size)
- Discord username
- Discord ID

**If account is linked (via `/link` or `/adminlink`):**

Three stat cards:
| Card | Shows |
|------|-------|
| **AGID** | The user's linked game account ID |
| **Marks** | Current currency balance |
| **Linked Since** | Date the account was first linked |

**Inventory Section:**
- Grid display of all items in the user's inventory
- Shows "Your inventory is empty." if no items

**If account is NOT linked:**
- Message explaining the account isn't linked yet
- Instructions to use `/link` in Discord or ask staff for `/adminlink`

---

### Staff Panel (`/admin`)

*Requires staff access (Support level or higher). See [Staff System](Staff-System.md).*

The admin panel adapts based on the logged-in user's staff level.

**Header:**
- Page title with a color-coded staff badge showing the user's level and tier name

**Stats Overview** (visible to all staff):
| Stat | Description |
|------|-------------|
| Linked Users | Total number of accounts linked in the database |
| Servers | Number of Discord servers the bot is in |
| Bot Uptime | How long the bot has been running |

**Linked Users Table:**

| Staff Level | Can View | Can Edit | Can Delete |
|-------------|----------|----------|------------|
| Support (1) | Yes (read-only) | No | No |
| Moderator (2) | Yes | AGID, Marks | No |
| Administrator (3) | Yes | AGID, Marks | Yes |

Table columns: Discord ID, AGID, Marks, Inventory Items count, Linked Since date, and Actions (if applicable).

**Staff Roles Configuration:**
- Table showing all configured staff role mappings (Role ID, Level, Guild ID, date configured)
- If no roles are configured, shows instructions to use `/staffrole assign`

**Access Levels Reference:**
- Quick reference cards explaining what each staff tier can do

**Recent Chat Bridge Messages:**
- Scrollable log of the 25 most recent bridged messages
- Each entry shows source (Discord/Game), author name, message content, and timestamp
- Discord messages highlighted in blue, game messages in green

---

### Tickets (`/tickets`)

*Requires login.*

Lists tickets visible to the current user.

- **Staff** see all tickets across all guilds
- **Regular users** see only tickets they created
- **Filter buttons:** All, Open, Closed
- **Table columns:** ID, Subject, Created By, Status, Claimed By, Created date, Closed date, Transcript link

Clicking **View** on a closed ticket opens the transcript detail page.

---

### Ticket Detail (`/tickets/:id/transcript`)

*Requires login. Must be the ticket creator or have staff access.*

Shows full details for a single ticket:

- **Info grid:** Subject, Created By, Created date, Claimed By, Closed By
- **Transcript viewer:** Embedded iframe displaying the saved HTML transcript
- **"Open Full Transcript"** button opens the raw transcript HTML in a new tab
- **Back link** returns to the ticket list

---

### Global Chat (`/chat`)

*Requires login.*

A real-time chatroom bridged with Discord and the in-game Global channel. See [Chat Bridge](Chat-Bridge.md) for full details.

**Features:**
- Live messages from Discord, the game, and other web users, all in one view
- Color-coded source labels: Discord (blue), Game (green), Web (purple)
- Connection status indicator (green/red dot) with auto-reconnect
- Online user count
- Message input with 500-character limit

**Staff Moderation** (Moderator level and above):
- **Moderation bar** — Toggle to see currently muted users
- **Delete message** — Hover a message and click ✕ to remove it
- **Mute user** — Hover a message and click the mute icon, enter reason and optional duration
- **Unmute user** — View muted users list and click "Unmute"

---

### Error Page

Displayed when:
- A user tries to access a page they don't have permission for (403)
- An authentication error occurs
- The server encounters an unexpected error

Shows an error title, descriptive message, and a link back to the home page.

---

## Navigation

The navigation bar appears on every page and includes:

| Element | Visibility | Description |
|---------|------------|-------------|
| **The Echo** (brand) | Always | Links to the home page |
| **Home** | Always | Links to `/` |
| **Dashboard** | Logged in | Links to `/dashboard` |
| **Chat** | Logged in | Links to `/chat` — real-time chatroom bridged with Discord and game |
| **Tickets** | Logged in | Links to `/tickets` — view your tickets or all tickets (staff) |
| **Staff Panel** | Staff only | Links to `/admin` (only shown if the user has a staff level) |
| **Staff Badge** | Staff only | Color-coded badge showing the user's tier (e.g. "Moderator") |
| **Avatar + Username** | Logged in | Shows the user's Discord avatar and username |
| **Logout** | Logged in | Destroys the session and redirects to home |
| **Login with Discord** | Logged out | Starts the OAuth2 login flow |

---

## Authentication Flow

1. User clicks **"Login with Discord"**
2. Redirected to Discord's OAuth2 authorization page
3. User authorizes the application (scopes: `identify`, `guilds.members.read`)
4. Discord redirects back to `/auth/callback` with an authorization code
5. The Echo exchanges the code for an access token
6. Fetches the user's Discord profile
7. If `STAFF_GUILD_ID` is set, fetches the user's roles in that guild and determines their staff level
8. Creates a session and redirects to `/dashboard`

Sessions are stored server-side. Logging out destroys the session entirely.

---

## Design

The dashboard uses a dark theme designed to feel at home alongside Discord:

- **Background:** Dark grays (`#0d1117`, `#161b22`)
- **Cards/panels:** Slightly lighter dark backgrounds with subtle borders
- **Accent color:** Purple (`#6e56cf`)
- **Text:** White/light gray with muted secondary text
- **Staff badges:** Blue (Support), Amber (Moderator), Red (Administrator)
- **Responsive:** Adapts to mobile screens with stacked layouts

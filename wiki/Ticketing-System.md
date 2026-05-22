# Ticketing System

The Echo includes a full-featured ticketing system for managing support requests directly through Discord, with transcript logging and a web interface for reviewing closed tickets.

---

## Overview

The ticketing system allows community members to create private support channels in Discord. Staff members can claim, manage, and close tickets. When a ticket is closed, the full conversation is saved as an HTML transcript and can be viewed through the web dashboard.

**Lifecycle:** Create → (Optional) Claim → Close → Transcript Saved

---

## Discord Commands

### `/ticket` — Ticket Management

| Subcommand | Description | Access |
|------------|-------------|--------|
| `create [subject]` | Creates a new ticket channel | Everyone |
| `close [reason]` | Closes the current ticket and saves a transcript | Ticket creator or staff |
| `add <user>` | Adds a user to the current ticket channel | Ticket creator or staff |
| `remove <user>` | Removes a user from the current ticket channel (cannot remove the creator) | Ticket creator or staff |
| `claim` | Claims the ticket (marks you as the assigned staff member) | Staff only |

#### `/ticket create`
- **Options:**
  - `subject` (optional) — A brief description of the issue (default: "No subject")
- **Behavior:**
  1. Creates a private channel named `ticket-XXXX` (zero-padded number) under the configured ticket category
  2. Sets permissions so only the creator, the bot, and the configured support role can see the channel
  3. Sends a welcome embed with a close button inside the new channel
  4. Logs the creation event to the configured log channel
  5. Returns an ephemeral reply linking to the new channel

#### `/ticket close`
- **Options:**
  - `reason` (optional) — Reason for closing the ticket
- **Behavior:**
  1. Fetches all messages from the channel
  2. Generates a styled HTML transcript
  3. Saves the transcript to the database
  4. Logs the closure event (with transcript stats) to the log channel
  5. Sends a closing message in the channel
  6. Deletes the channel after 5 seconds
- **Restriction:** Must be used inside a ticket channel

#### `/ticket add`
- **Options:**
  - `user` (required) — The Discord user to add
- **Behavior:** Grants the user View Channel, Send Messages, Read Message History, and Attach Files permissions in the ticket channel

#### `/ticket remove`
- **Options:**
  - `user` (required) — The Discord user to remove
- **Behavior:** Removes the user's permission overwrite from the ticket channel. Cannot remove the ticket creator.

#### `/ticket claim`
- **Behavior:** Records the claiming staff member in the database and sends a notification in the ticket channel

---

### `/ticketsetup` — Configuration

All subcommands require **Administrator** permission in the Discord server.

| Subcommand | Description |
|------------|-------------|
| `category <channel>` | Set the channel category where new tickets are created |
| `log-channel <channel>` | Set the channel where ticket events (create, close) are logged |
| `support-role <role>` | Set the Discord role that automatically gets access to all tickets |
| `welcome-message <message>` | Set the message shown when a ticket is created |
| `panel [title] [description]` | Send a ticket creation panel (embed with button) to the current channel |
| `view` | Display current ticket configuration and stats |

#### Setting Up Tickets

Minimum setup for the ticketing system to work:

1. Create a channel category in Discord for tickets (e.g. "Support Tickets")
2. Create a text channel for ticket logs (e.g. `#ticket-logs`)
3. Create or choose a Discord role for your support team
4. Run the setup commands:

```
/ticketsetup category #support-tickets-category
/ticketsetup log-channel #ticket-logs
/ticketsetup support-role @Support Team
```

5. Optionally customize the welcome message:

```
/ticketsetup welcome-message Hello! A member of our team will assist you shortly. Please describe your issue.
```

6. Create a ticket panel in a channel where users can click a button to open tickets:

```
/ticketsetup panel title:Support description:Click the button below to create a support ticket.
```

#### `/ticketsetup view`

Displays a summary embed showing:
- Configured category, log channel, and support role
- Current welcome message
- Total ticket count
- Ticket stats (total, open, closed)

---

## Ticket Panel

The `/ticketsetup panel` command creates a persistent embed with a **"Create Ticket"** button. When a user clicks the button:

1. A new ticket channel is created (same behavior as `/ticket create`)
2. The user receives an ephemeral reply with a link to their new channel
3. The ticket channel includes a welcome embed and a **"Close Ticket"** button

This is the recommended way to let users create tickets — it's visible, discoverable, and doesn't require users to know slash commands.

---

## Transcripts

When a ticket is closed, the bot:

1. Fetches every message in the channel (in batches of 100)
2. Sorts messages chronologically
3. Generates a styled HTML document that includes:
   - Ticket metadata (ID, subject, creator, channel name, creation date)
   - Every message with author name, avatar color, timestamp, and content
   - A Discord-like dark theme
4. Saves the HTML and message count to the database

Transcripts are permanent and can be viewed through the web dashboard at any time.

---

## Web Interface

### Tickets List (`/tickets`)

*Requires login.*

- **Staff** see all tickets across the system
- **Regular users** see only tickets they created
- **Filter buttons** allow filtering by status: All, Open, or Closed
- **Table columns:** ID, Subject, Created By, Status, Claimed By, Created date, Closed date, and a Transcript link for closed tickets

### Ticket Detail (`/tickets/:id/transcript`)

*Requires login. Must be the ticket creator or staff.*

- **Ticket info grid:** Subject, Created By, Created date, Claimed By, Closed By
- **Transcript viewer:** Embedded iframe showing the full HTML transcript
- **"Open Full Transcript"** button opens the raw HTML in a new tab

### Staff Panel Integration

The staff admin panel (`/admin`) includes a **Tickets Overview** section showing:
- Total, open, and closed ticket counts
- A table of the 10 most recent tickets with quick links to transcripts

---

## Database Tables

The ticketing system uses three database tables:

| Table | Purpose |
|-------|---------|
| `tickets` | Stores ticket metadata (creator, subject, status, claimed_by, timestamps) |
| `ticket_settings` | Per-guild configuration (category, log channel, support role, welcome message, ticket count) |
| `ticket_transcripts` | Stores the generated HTML transcript and message count for each closed ticket |

---

## Permissions

### Channel Permissions

When a ticket channel is created, these permission overwrites are applied:

| Target | Permissions |
|--------|-------------|
| `@everyone` | Deny View Channel (hidden from all) |
| Ticket creator | View Channel, Send Messages, Read Message History, Attach Files |
| Bot | View Channel, Send Messages, Manage Channels, Read Message History |
| Support role | View Channel, Send Messages, Read Message History |

### Web Access

| Role | Can View | Can Access Transcripts |
|------|----------|----------------------|
| Regular user | Own tickets only | Own transcripts only |
| Staff (any level) | All tickets | All transcripts |
| Bot owner | All tickets | All transcripts |

### Bot Permissions Required

The bot needs these Discord permissions for the ticketing system to work:
- **Manage Channels** — Create and delete ticket channels
- **View Channels** — Access ticket channels
- **Send Messages** — Send welcome messages and notifications
- **Read Message History** — Fetch messages for transcript generation
- **Embed Links** — Send rich embeds for ticket panels and notifications

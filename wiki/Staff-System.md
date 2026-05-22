# Staff System

The Echo uses a **role-based access control** system driven by Discord roles. Staff access is organized into three tiers, each with increasing permissions on both the web dashboard and (in future) in-game tools.

## Staff Tiers

| Level | Name | Badge Color | Description |
|-------|------|-------------|-------------|
| 1 | **Support** | Blue | View-only access to the staff panel. Can see linked users, stats, and chat bridge logs but cannot make changes. |
| 2 | **Moderator** | Amber | Everything in Support, plus the ability to edit user data (AGID and marks). |
| 3 | **Administrator** | Red | Full access. Everything in Moderator, plus the ability to delete user records. |

The bot owner (defined in `config.users.ownerId`) always has Administrator access regardless of their Discord roles — this ensures you can never be locked out.

---

## How It Works

### 1. Map Discord roles to staff levels

Use the `/staffrole` command in Discord to map your server's roles to staff tiers:

```
/staffrole assign @Support-Team 1     → Support (view-only)
/staffrole assign @Moderators 2       → Moderator (edit users)
/staffrole assign @Admins 3           → Administrator (full access)
```

These mappings are stored in the database and persist across bot restarts.

### 2. User logs into the web dashboard

When a user logs in with Discord OAuth2, The Echo:

1. Fetches the user's profile from Discord
2. Fetches the user's roles from the guild specified by `STAFF_GUILD_ID`
3. Looks up each of the user's Discord roles in the `staff_roles` database table
4. Assigns the **highest** matching staff level to the user's session

For example, if a user has both a Support role (level 1) and a Moderator role (level 2), they'll be granted Moderator access.

### 3. Access is enforced on every request

The web middleware checks the user's staff level before allowing access to protected routes:

| Route | Minimum Level |
|-------|---------------|
| `GET /admin` | Support (1) |
| `GET /chat/mutes` | Support (1) |
| `POST /admin/users/:id/update` | Moderator (2) |
| `POST /admin/users/:id/delete` | Administrator (3) |
| `POST /chat/mute` | Moderator (2) |
| `POST /chat/unmute` | Moderator (2) |
| `POST /chat/delete-message` | Moderator (2) |

---

## Managing Staff Roles

All `/staffrole` subcommands are restricted to the **bot owner** only.

### Assign a role

```
/staffrole assign <role> <level>
```

Maps a Discord role to a staff access level. If the role was already assigned, it updates the level.

**Level choices:**
- `Support (view-only)` — Level 1
- `Moderator (edit users)` — Level 2
- `Administrator (full access)` — Level 3

### Remove a role

```
/staffrole remove <role>
```

Removes the role from staff access. Users who only had this role will lose staff access on their next login.

### List all roles

```
/staffrole list
```

Shows all configured staff roles for the current server, including the role name and assigned level.

---

## Configuration

### Required Environment Variable

```env
STAFF_GUILD_ID=your_discord_server_id
```

This tells The Echo which Discord guild's roles to check when a user logs into the web dashboard. Without this, role-based staff detection is disabled (only the bot owner will have staff access).

### How to find your Guild ID

1. In Discord, go to **User Settings → Advanced → Developer Mode** (enable it)
2. Right-click your server name → **Copy Server ID**

---

## Web Dashboard Behavior by Tier

### Support (Level 1)
- ✓ View the Staff Panel
- ✓ See stats (linked users, servers, uptime)
- ✓ See the linked users table (read-only — no edit fields)
- ✓ See staff roles configuration
- ✓ See recent chat bridge messages
- ✓ View active chat mutes
- ✗ Cannot edit user data
- ✗ Cannot delete users
- ✗ Cannot mute/unmute users or delete messages

### Moderator (Level 2)
- ✓ Everything in Support
- ✓ Edit user AGID (inline text field)
- ✓ Edit user marks (inline number field)
- ✓ Save changes to user records
- ✓ Mute/unmute users in web chat
- ✓ Delete messages in web chat
- ✗ Cannot delete users

### Administrator (Level 3)
- ✓ Everything in Moderator
- ✓ Delete user records (with confirmation prompt)

### Bot Owner
- ✓ Everything in Administrator (always, regardless of Discord roles)
- ✓ The `/staffrole` command in Discord

---

## Important Notes

- **Users must re-login** after their Discord roles change for the new staff level to take effect. The staff level is determined at login time and cached in the session.
- **Multiple roles are supported.** If a user has several roles mapped to different levels, they get the highest level.
- **Staff roles are per-guild.** Each Discord server can have its own set of role mappings, but only the guild specified by `STAFF_GUILD_ID` is checked during web login.
- **Removing a role mapping** does not immediately revoke access for users who are already logged in. Their access will be updated on their next login.

---

## Future Plans

The three-tier system is designed to be extended with additional permissions for in-game tools and moderation features as development progresses.

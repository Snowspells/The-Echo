const { ChatInputCommandInteraction, ApplicationCommandOptionType, ChannelType, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { info, error, warn } = require("../../utils/Console");

module.exports = new ApplicationCommand({
    command: {
        name: 'ticket',
        description: 'Manage support tickets',
        type: 1,
        options: [{
            name: 'create',
            description: 'Create a new support ticket',
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: 'subject',
                description: 'Brief description of your issue',
                type: ApplicationCommandOptionType.String,
                required: false
            }]
        }, {
            name: 'close',
            description: 'Close the current ticket',
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: 'reason',
                description: 'Reason for closing',
                type: ApplicationCommandOptionType.String,
                required: false
            }]
        }, {
            name: 'add',
            description: 'Add a user to the current ticket',
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: 'user',
                description: 'The user to add',
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        }, {
            name: 'remove',
            description: 'Remove a user from the current ticket',
            type: ApplicationCommandOptionType.Subcommand,
            options: [{
                name: 'user',
                description: 'The user to remove',
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        }, {
            name: 'claim',
            description: 'Claim this ticket as the handling staff member',
            type: ApplicationCommandOptionType.Subcommand
        }]
    },
    options: {
        cooldown: 3000
    },

    /**
     * @param {import("../../client/DiscordBot")} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'create') {
                await handleCreate(client, interaction);
            } else if (subcommand === 'close') {
                await handleClose(client, interaction);
            } else if (subcommand === 'add') {
                await handleAdd(client, interaction);
            } else if (subcommand === 'remove') {
                await handleRemove(client, interaction);
            } else if (subcommand === 'claim') {
                await handleClaim(client, interaction);
            }
        } catch (err) {
            error('Ticket command error:', err);
            const reply = { content: 'An error occurred while processing the ticket command.', flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
}).toJSON();

async function handleCreate(client, interaction) {
    const subject = interaction.options.getString('subject') || 'No subject';
    const settings = client.database.getTicketSettings(interaction.guild.id);
    const ticketNumber = client.database.incrementTicketCount(interaction.guild.id);
    const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

    const permissionOverwrites = [
        {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
        },
        {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory]
        }
    ];

    if (settings?.support_role_id) {
        const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
        if (supportRole) {
            permissionOverwrites.push({
                id: settings.support_role_id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
        }
    }

    const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Ticket #${ticketNumber} | ${subject} | Created by ${interaction.user.username}`,
        permissionOverwrites
    };

    if (settings?.category_id) {
        channelOptions.parent = settings.category_id;
    }

    const channel = await interaction.guild.channels.create(channelOptions);

    const ticketId = client.database.createTicket(
        interaction.guild.id,
        channel.id,
        interaction.user.id,
        interaction.user.username,
        subject
    );

    const welcomeMessage = settings?.welcome_message || 'Thank you for creating a ticket! A staff member will be with you shortly.';

    const embed = new EmbedBuilder()
        .setColor(0x6e56cf)
        .setTitle(`Ticket #${ticketNumber}`)
        .setDescription(welcomeMessage)
        .addFields(
            { name: 'Subject', value: subject, inline: true },
            { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Ticket ID', value: `#${ticketId}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Use /ticket close to close this ticket' });

    await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [{
            type: 1,
            components: [{
                type: 2,
                custom_id: `ticket-close-${ticketId}`,
                label: 'Close Ticket',
                style: 4,
                emoji: { name: '🔒' }
            }]
        }]
    });

    await interaction.reply({
        content: `Ticket created! Head to <#${channel.id}>`,
        flags: MessageFlags.Ephemeral
    });

    await logTicketEvent(client, interaction.guild.id, {
        color: 0x57f287,
        title: 'Ticket Created',
        fields: [
            { name: 'Ticket', value: `#${ticketId} (${channelName})`, inline: true },
            { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Subject', value: subject, inline: true }
        ]
    });

    info(`Ticket #${ticketId} created by ${interaction.user.username} in ${interaction.guild.name}`);
}

async function handleClose(client, interaction) {
    const ticket = client.database.getTicketByChannelId(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({
            content: 'This channel is not an open ticket.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Ticket Closing')
            .setDescription(`This ticket is being closed by <@${interaction.user.id}>.\n**Reason:** ${reason}\n\nGenerating transcript and closing in 5 seconds...`)
            .setTimestamp()
        ]
    });

    const transcript = await generateTranscript(interaction.channel, ticket);
    client.database.saveTranscript(ticket.id, ticket.guild_id, transcript.html, transcript.messageCount);
    client.database.closeTicket(ticket.id, interaction.user.id, interaction.user.username);

    await logTicketEvent(client, interaction.guild.id, {
        color: 0xed4245,
        title: 'Ticket Closed',
        fields: [
            { name: 'Ticket', value: `#${ticket.id}`, inline: true },
            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Originally By', value: `<@${ticket.creator_id}>`, inline: true },
            { name: 'Reason', value: reason },
            { name: 'Messages', value: `${transcript.messageCount}`, inline: true }
        ]
    });

    info(`Ticket #${ticket.id} closed by ${interaction.user.username} (${reason})`);

    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (err) {
            warn(`Could not delete ticket channel: ${err.message}`);
        }
    }, 5000);
}

async function handleAdd(client, interaction) {
    const ticket = client.database.getTicketByChannelId(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({ content: 'This channel is not an open ticket.', flags: MessageFlags.Ephemeral });
        return;
    }

    const user = interaction.options.getUser('user', true);

    await interaction.channel.permissionOverwrites.create(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
    });

    await interaction.reply({ content: `<@${user.id}> has been added to this ticket.` });
    info(`${interaction.user.username} added ${user.username} to ticket #${ticket.id}`);
}

async function handleRemove(client, interaction) {
    const ticket = client.database.getTicketByChannelId(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({ content: 'This channel is not an open ticket.', flags: MessageFlags.Ephemeral });
        return;
    }

    const user = interaction.options.getUser('user', true);

    if (user.id === ticket.creator_id) {
        await interaction.reply({ content: 'You cannot remove the ticket creator.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.channel.permissionOverwrites.delete(user.id);
    await interaction.reply({ content: `<@${user.id}> has been removed from this ticket.` });
    info(`${interaction.user.username} removed ${user.username} from ticket #${ticket.id}`);
}

async function handleClaim(client, interaction) {
    const ticket = client.database.getTicketByChannelId(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({ content: 'This channel is not an open ticket.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (ticket.claimed_by) {
        await interaction.reply({
            content: `This ticket is already claimed by <@${ticket.claimed_by}>.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    client.database.updateTicket(ticket.id, {
        claimed_by: interaction.user.id,
        claimed_by_name: interaction.user.username
    });

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
            .setTimestamp()
        ]
    });

    info(`Ticket #${ticket.id} claimed by ${interaction.user.username}`);
}

async function generateTranscript(channel, ticket) {
    const messages = [];
    let lastId = null;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;

        messages.push(...fetched.values());
        lastId = fetched.last().id;

        if (fetched.size < 100) break;
    }

    messages.reverse();

    const html = buildTranscriptHtml(messages, ticket, channel);
    return { html, messageCount: messages.length };
}

function buildTranscriptHtml(messages, ticket, channel) {
    const messageRows = messages.map(msg => {
        const time = new Date(msg.createdTimestamp).toISOString();
        const authorColor = msg.author.bot ? '#5865f2' : '#ffffff';
        const attachments = msg.attachments.size > 0
            ? `<div class="attachments">${msg.attachments.map(a => `<a href="${a.url}" target="_blank">${a.name}</a>`).join(', ')}</div>`
            : '';
        const embeds = msg.embeds.length > 0
            ? `<div class="embed-indicator">[${msg.embeds.length} embed(s)]</div>`
            : '';

        const escapedContent = msg.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        return `
            <div class="message">
                <div class="message-header">
                    <span class="author" style="color: ${authorColor}">${msg.author.username}</span>
                    <span class="timestamp">${time}</span>
                </div>
                <div class="message-body">${escapedContent}</div>
                ${attachments}
                ${embeds}
            </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript — Ticket #${ticket.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #36393f; color: #dcddde; font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; font-size: 15px; }
        .header { background: #2f3136; padding: 1.5rem 2rem; border-bottom: 1px solid #202225; }
        .header h1 { color: #fff; font-size: 1.3rem; margin-bottom: 0.5rem; }
        .header .meta { color: #72767d; font-size: 0.85rem; }
        .header .meta span { margin-right: 1.5rem; }
        .messages { padding: 1rem 2rem; }
        .message { padding: 0.5rem 0; display: flex; flex-direction: column; }
        .message:hover { background: #32353b; }
        .message-header { display: flex; align-items: baseline; gap: 0.5rem; }
        .author { font-weight: 600; font-size: 0.95rem; }
        .timestamp { color: #72767d; font-size: 0.75rem; }
        .message-body { margin-top: 0.2rem; line-height: 1.4; word-wrap: break-word; }
        .attachments { margin-top: 0.3rem; }
        .attachments a { color: #00aff4; text-decoration: none; }
        .attachments a:hover { text-decoration: underline; }
        .embed-indicator { color: #72767d; font-size: 0.8rem; font-style: italic; margin-top: 0.2rem; }
        .footer { background: #2f3136; padding: 1rem 2rem; border-top: 1px solid #202225; color: #72767d; font-size: 0.8rem; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Ticket #${ticket.id} — ${ticket.subject || 'No subject'}</h1>
        <div class="meta">
            <span>Created by: ${ticket.creator_name}</span>
            <span>Channel: #${channel.name}</span>
            <span>Messages: ${messages.length}</span>
        </div>
    </div>
    <div class="messages">
        ${messageRows}
    </div>
    <div class="footer">
        Generated by The Echo — ${new Date().toISOString()}
    </div>
</body>
</html>`;
}

async function logTicketEvent(client, guildId, embedData) {
    try {
        const settings = client.database.getTicketSettings(guildId);
        if (!settings?.log_channel_id) return;

        const logChannel = client.channels.cache.get(settings.log_channel_id);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(embedData.color)
            .setTitle(embedData.title)
            .setTimestamp();

        if (embedData.fields) {
            embedData.fields.forEach(f => embed.addFields(f));
        }

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        warn(`Could not send ticket log: ${err.message}`);
    }
}

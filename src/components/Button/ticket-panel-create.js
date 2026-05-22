const { ButtonInteraction, ChannelType, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require("discord.js");
const Component = require("../../structure/Component");
const { info, error, warn } = require("../../utils/Console");

module.exports = new Component({
    customId: 'ticket-panel-create',
    type: 'button',
    /**
     * @param {import("../../client/DiscordBot")} client
     * @param {ButtonInteraction} interaction
     */
    run: async (client, interaction) => {
        try {
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
                topic: `Ticket #${ticketNumber} | Created by ${interaction.user.username}`,
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
                'No subject'
            );

            const welcomeMessage = settings?.welcome_message || 'Thank you for creating a ticket! A staff member will be with you shortly.';

            const embed = new EmbedBuilder()
                .setColor(0x6e56cf)
                .setTitle(`Ticket #${ticketNumber}`)
                .setDescription(welcomeMessage)
                .addFields(
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

            // Log the event
            if (settings?.log_channel_id) {
                const logChannel = client.channels.cache.get(settings.log_channel_id);
                if (logChannel) {
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setColor(0x57f287)
                            .setTitle('Ticket Created')
                            .addFields(
                                { name: 'Ticket', value: `#${ticketId} (${channelName})`, inline: true },
                                { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }

            info(`Ticket #${ticketId} created via panel by ${interaction.user.username} in ${interaction.guild.name}`);
        } catch (err) {
            error('Ticket panel create error:', err);
            try {
                await interaction.reply({
                    content: 'An error occurred while creating the ticket.',
                    flags: MessageFlags.Ephemeral
                });
            } catch {}
        }
    }
}).toJSON();

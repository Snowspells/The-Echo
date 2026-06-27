const { ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'linkverify',
        description: 'Finish linking your account with the code whispered to you in-game',
        type: 1,
        options: [{
            name: 'code',
            description: 'The verification code whispered to you in Path of Titans',
            type: ApplicationCommandOptionType.String,
            required: true
        }]
    },
    options: {
        cooldown: 5000
    },

    /**
     * @param {import("../../client/DiscordBot")} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        const { info, error } = require('../../utils/Console');
        try {
            const discordId = interaction.user.id;
            const code = interaction.options.getString('code', true).trim().toUpperCase();

            const pending = client.database.getLinkVerification(discordId);
            if (!pending) {
                await interaction.reply({
                    content: 'You have no pending link request. Start one with `/link agid:<your AGID>`.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (new Date(pending.expires_at) < new Date()) {
                client.database.deleteLinkVerification(discordId);
                await interaction.reply({
                    content: 'Your verification code has expired. Please run `/link` again.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (code !== pending.code.toUpperCase()) {
                await interaction.reply({
                    content: 'That code is incorrect. Double-check the code whispered to you in-game.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Guard against a race where the AGID got linked elsewhere meanwhile.
            const existingOwner = client.database.getUserByAgid(pending.agid);
            if (existingOwner && existingOwner.DID !== discordId) {
                client.database.deleteLinkVerification(discordId);
                await interaction.reply({
                    content: `AGID \`${pending.agid}\` was linked to another account. Contact an administrator.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (client.database.userExists(discordId)) {
                client.database.updateUser(discordId, { agid: pending.agid });
            } else {
                client.database.createUser(discordId, pending.agid, 0, []);
            }
            client.database.deleteLinkVerification(discordId);

            info(`User verified and linked: DID=${discordId} AGID=${pending.agid}`);
            await interaction.reply({
                content: `Verified! <@${discordId}> is now linked to AGID \`${pending.agid}\`.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (err) {
            error(err);
            try {
                await interaction.reply({ content: 'An error occurred during verification. Try again later.', flags: MessageFlags.Ephemeral });
            } catch {}
        }
    }
}).toJSON();

const { ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'adminlink',
        description: "Admin command to create or overwrite a user's linked AGID",
        type: 1,
        options: [{
            name: 'user',
            description: 'The user to link',
            type: ApplicationCommandOptionType.User,
            required: true
        }, {
            name: 'agid',
            description: 'The AGID to link to the user',
            type: ApplicationCommandOptionType.String,
            required: true
        }]
    },
    options: {
        cooldown: 5000,
        botDevelopers: true
    },

    /**
     * @param {import("../../client/DiscordBot")} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        const { info, error } = require('../../utils/Console');
        try {
            const targetUser = interaction.options.getUser('user', true);
            const agid = interaction.options.getString('agid', true);
            const discordId = targetUser.id;

            if (client.database.userExists(discordId)) {
                // Update existing user
                client.database.updateUser(discordId, { agid });
                info(`Updated user: DID=${discordId} AGID=${agid}`);

                await interaction.reply({
                    content: `Successfully updated <@${discordId}>'s AGID to \`${agid}\`.`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                // Create new user
                client.database.createUser(discordId, agid, 0, []);
                info(`New user linked by admin: DID=${discordId} AGID=${agid}`);

                await interaction.reply({
                    content: `Successfully linked <@${discordId}> with AGID: \`${agid}\`.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (err) {
            error(err);
            try {
                await interaction.reply({ content: 'An error occurred while linking. Try again later.', flags: MessageFlags.Ephemeral });
            } catch {}
        }
    }
}).toJSON();

const { ChatInputCommandInteraction, MessageFlags } = require("discord.js");
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'link',
        description: "Links player's Discord ID to the database (testing)",
        type: 1,
        options: []
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
            const dummyAgid = `AGID-${Date.now()}`;

            if (client.database.userExists(discordId)) {
                await interaction.reply({
                    content: 'You are already linked. Use an admin command to overwrite.',
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            client.database.createUser(discordId, dummyAgid, 0, []);
            info(`New user linked: DID=${discordId} AGID=${dummyAgid}`);

            await interaction.reply({
                content: `Successfully created database entry for <@${discordId}> with dummy AGID: \`${dummyAgid}\`.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (err) {
            error(err);
            try {
                await interaction.reply({ content: 'An error occurred while linking. Try again later.', flags: MessageFlags.Ephemeral });
            } catch {}
        }
    }
}).toJSON();

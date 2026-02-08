const { ChatInputCommandInteraction } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { QuickYAML } = require("quick-yaml.db");

module.exports = new ApplicationCommand({
    command: {
        name: 'link',
        description: "Links player's Discord UUID to AGID (Nonfunctional at this time!)",
        type: 1,
        options: []
    },
    options: {
        cooldown: 5000
    },

    /**
     * @param {DiscordBot} client
     * @param {ChatInputCommandInteraction} interaction
/     */
    run: async (client, interaction) => {

        const discordId = interaction.user.id;

        if (!DiscordBot.database.data.players) DiscordBot.database.data.players = {};

        DiscordBot.database.data.players[discordId] = {
            agid: null,
            Marks: null,
            Inventory: null,
            Infractions: null
        };

        DiscordBot.database.save();

        await interaction.reply({
            content: `Created test DB entry for ${discordId}`,
            ephemeral: true
        });
    }
}).toJSON();

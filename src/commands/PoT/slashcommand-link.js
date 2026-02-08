const { ChatInputCommandInteraction } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const { QuickYAML } = require("quick-yaml.db");

module.exports = new ApplicationCommand({
    command: {
        name: 'link',
        description: "Links player's Discord UUID to AGID (WIP)",
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
        
        Model = [
                { variable: 'DID', type: string },
                { variable: 'AGID', type: string },
                { variable: 'Marks', type: number },
                { variable: 'Inventory', type: string[''] }
                
            ];
            
        const db = new QuickYAML<Model>(DiscordBot.config.database);
        
        

        await interaction.reply({
            content: `Created test DB entry for ${discordId}`,
            ephemeral: true
        });
    }
}).toJSON();

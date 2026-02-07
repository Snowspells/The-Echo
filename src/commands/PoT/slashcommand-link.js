const { ChatInputCommandInteraction } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");

const { QuickYAML } = require('quick-yaml.db');
const db = new QuickYAML('./database.yaml');


module.exports = new ApplicationCommand({
    command: {
        name: 'link',
        description: 'Links Discord UID to AGID',
        type: 1,
        options: []
    },
    options: {
        cooldown: 5000
    },
    
    /**
     * 
     * @param {DiscordBot} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    run: async (client, interaction) => {
        
        db.set('EID: ' + message.user.id, { DID: message.user.id, AGID:'' }),

        await interaction.reply({
            content: '**Test Complete! (no under-the-hood code was run)**'
        });
    }
}).toJSON();
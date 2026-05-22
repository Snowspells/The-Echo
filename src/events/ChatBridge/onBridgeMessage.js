const { info, warn, error, debug } = require("../../utils/Console");
const Event = require("../../structure/Event");

module.exports = new Event({
    event: 'messageCreate',
    once: false,
    run: async (client, message) => {
        if (message.author.bot) return;

        const bridgeChannelId = process.env.BRIDGE_CHANNEL_ID;
        if (!bridgeChannelId || message.channel.id !== bridgeChannelId) return;

        const gameWebhookUrl = process.env.GAME_WEBHOOK_URL;
        if (!gameWebhookUrl) {
            debug('Chat bridge: GAME_WEBHOOK_URL not configured, skipping outbound relay');
            return;
        }

        const displayName = message.member?.displayName || message.author.username;
        const content = message.cleanContent;

        if (!content || content.length === 0) return;

        try {
            const response = await fetch(gameWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.BRIDGE_API_KEY || ''
                },
                body: JSON.stringify({
                    playerName: displayName,
                    message: content,
                    discordId: message.author.id,
                    source: 'discord'
                })
            });

            if (response.ok) {
                client.database.logBridgeMessage('discord', displayName, message.author.id, content);
                debug(`Bridge (Discord -> Game): ${displayName}: ${content}`);
            } else {
                warn(`Bridge relay failed (${response.status}): ${displayName}: ${content}`);
            }
        } catch (err) {
            error('Bridge relay error:', err);
        }
    }
}).toJSON();

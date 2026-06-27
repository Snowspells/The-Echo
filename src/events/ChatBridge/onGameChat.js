const { info, debug } = require("../../utils/Console");
const Event = require("../../structure/Event");
const { parseWebhookMessage } = require("../../utils/pot");

/**
 * Inbound side of the Path of Titans bridge.
 *
 * A PoT dedicated server's built-in Discord integration posts in-game Global
 * chat and join/leave events (including each player's AlderonId) to a dedicated
 * Discord channel via a webhook. This listener watches that channel, parses the
 * webhook output, and relays it to the bridge Discord channel + website, logs
 * it, and tracks in-game presence (AGIDs) for account linking.
 *
 * Configuration:
 *   GAME_CHAT_CHANNEL_ID   - channel that receives the PoT server's webhook
 *   BRIDGE_CHANNEL_ID      - human Discord chat channel (game chat is relayed here)
 *   BRIDGE_RELAY_JOINS     - "true" to also relay join/leave to the bridge channel
 */
module.exports = new Event({
    event: 'messageCreate',
    once: false,
    run: async (client, message) => {
        const gameChatChannelId = process.env.GAME_CHAT_CHANNEL_ID;
        if (!gameChatChannelId || message.channel.id !== gameChatChannelId) return;

        // Only process messages from the PoT server webhook, never our own relays
        // or human chatter in the channel.
        if (!message.webhookId) return;
        if (message.applicationId && message.applicationId === client.user?.id) return;

        const events = parseWebhookMessage(message);
        if (events.length === 0) {
            debug(`Game chat: unparsed webhook message: ${message.content?.slice(0, 120)}`);
            return;
        }

        const serverName = client.rcon?.defaultServerName?.() || null;
        const bridgeChannelId = process.env.BRIDGE_CHANNEL_ID;
        const relayJoins = process.env.BRIDGE_RELAY_JOINS === 'true';

        // Avoid duplicating into the same channel the webhook already posts to.
        const relayChannel = (bridgeChannelId && bridgeChannelId !== gameChatChannelId)
            ? client.channels?.cache?.get(bridgeChannelId)
            : null;

        for (const ev of events) {
            if (ev.agid) {
                client.database.upsertGamePlayer(
                    ev.agid,
                    ev.name,
                    serverName,
                    ev.type === 'leave' ? 0 : 1
                );
            }

            if (ev.type === 'chat') {
                // Drop echoes of messages we just relayed into the game.
                if (client.rcon?.wasRecentlyRelayed(`${ev.name}: ${ev.content}`)) {
                    debug(`Game chat: skipped relayed echo from ${ev.name}`);
                    continue;
                }

                client.database.logBridgeMessage('game', ev.name, ev.agid || null, ev.content);
                info(`Bridge (Game -> Discord): ${ev.name}: ${ev.content}`);

                if (relayChannel) {
                    relayChannel.send(`**[Global] ${ev.name}:** ${ev.content}`).catch(() => {});
                }
                if (client.webServer) {
                    client.webServer.relayMessageToWeb('game', ev.name, ev.agid || null, ev.content);
                }
            } else if (ev.type === 'join' || ev.type === 'leave') {
                const verb = ev.type === 'join' ? 'joined' : 'left';
                debug(`Game presence: ${ev.name} (${ev.agid || 'no AGID'}) ${verb}`);

                if (relayJoins && relayChannel) {
                    relayChannel.send(`*${ev.name} ${verb} the server.*`).catch(() => {});
                }
                if (client.webServer) {
                    client.webServer.broadcastToWebClients({
                        type: 'system',
                        content: `${ev.name} ${verb} the server.`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
    }
}).toJSON();

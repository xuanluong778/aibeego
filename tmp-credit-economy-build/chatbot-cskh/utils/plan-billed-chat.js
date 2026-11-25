"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planBilledChat = planBilledChat;
const database_1 = require("@marketingspa/database");
const node_crypto_1 = require("node:crypto");
/** Keep legacy contracts; all new plan chatbot channels share credit and monthly reply limits. */
function planBilledChat(db, organizationId, chat) {
    if (!chat)
        return undefined;
    return async (input) => {
        const referenceId = `chatbot:${(0, node_crypto_1.randomUUID)()}`;
        const { subscription } = await (0, database_1.organizationPlan)(db, organizationId);
        if (!subscription)
            throw new Error('SUBSCRIPTION_REQUIRED');
        return new database_1.CreditLedger(db).runPaidFeature({
            organizationId,
            featureCode: 'chatbot.reply',
            referenceId,
            fn: async (context) => {
                return chat(input);
            },
        });
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantToolRegistry = exports.looseObjectArgsSchema = exports.emptyArgsSchema = void 0;
const shared_1 = require("@marketingspa/shared");
exports.emptyArgsSchema = {
    safeParse: () => ({ success: true, data: {} }),
};
exports.looseObjectArgsSchema = {
    safeParse: (input) => {
        if (input == null)
            return { success: true, data: {} };
        if (typeof input !== 'object' || Array.isArray(input)) {
            return {
                success: false,
                error: { issues: [{ message: 'args must be a plain object' }] },
            };
        }
        return { success: true, data: input };
    },
};
/**
 * In-memory tool catalog for Trợ lý Bạch Cốt Tinh.
 * Separate from Chatbot CSKH and Ads MCP catalogs.
 */
class AssistantToolRegistry {
    tools = new Map();
    register(def) {
        if (this.tools.has(def.name)) {
            throw new Error(`assistant_tool_duplicate:${def.name}`);
        }
        this.tools.set(def.name, def);
    }
    get(name) {
        return this.tools.get(name);
    }
    list() {
        return [...this.tools.values()];
    }
    listDescriptorsForContext(ctx) {
        return this.list()
            .filter((t) => (0, shared_1.assistantHasAllPermissions)(ctx, t.permissions))
            .map((t) => ({
            name: t.name,
            description: t.description,
            permissions: [...t.permissions],
            mutates: t.mutates,
        }));
    }
}
exports.AssistantToolRegistry = AssistantToolRegistry;

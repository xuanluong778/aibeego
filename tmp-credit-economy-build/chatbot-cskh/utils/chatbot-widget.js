"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveChatbotWidgetPath = resolveChatbotWidgetPath;
const fs_1 = require("fs");
const path_1 = require("path");
/** Resolve widget.js on disk (dev tsc, nest build assets, or monorepo web public). */
function resolveChatbotWidgetPath() {
    const candidates = [
        (0, path_1.join)(process.cwd(), 'src', 'public', 'chatbot', 'widget.js'),
        (0, path_1.join)(process.cwd(), 'apps', 'api', 'src', 'public', 'chatbot', 'widget.js'),
        (0, path_1.join)(__dirname, '..', '..', '..', 'src', 'public', 'chatbot', 'widget.js'),
        (0, path_1.join)(__dirname, '..', '..', '..', '..', 'web', 'public', 'chatbot', 'widget.js'),
        (0, path_1.join)(process.cwd(), 'apps', 'web', 'public', 'chatbot', 'widget.js'),
    ];
    for (const p of candidates) {
        if ((0, fs_1.existsSync)(p))
            return p;
    }
    return null;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashSignal = hashSignal;
const crypto_1 = require("crypto");
function hashSignal(value) {
    return (0, crypto_1.createHash)('sha256').update(String(value || '')).digest('hex');
}

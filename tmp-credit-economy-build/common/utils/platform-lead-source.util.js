"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadSourceCodesForPlatform = leadSourceCodesForPlatform;
const database_1 = require("@marketingspa/database");
/** Map ad platform → lead source codes trong DB seed */
const PLATFORM_SOURCE_CODES = {
    [database_1.AdPlatform.META]: ['facebook'],
    [database_1.AdPlatform.GOOGLE]: ['google'],
    [database_1.AdPlatform.TIKTOK]: ['tiktok'],
    [database_1.AdPlatform.ZALO]: ['zalo'],
    [database_1.AdPlatform.MANUAL]: [],
    [database_1.AdPlatform.OTHER]: [],
};
function leadSourceCodesForPlatform(platform) {
    return PLATFORM_SOURCE_CODES[platform] ?? [];
}

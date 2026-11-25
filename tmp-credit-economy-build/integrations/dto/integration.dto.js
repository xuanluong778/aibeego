"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATION_CREDENTIAL_FIELDS = exports.ConnectIntegrationDto = void 0;
const class_validator_1 = require("class-validator");
class ConnectIntegrationDto {
    credentials;
}
exports.ConnectIntegrationDto = ConnectIntegrationDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ConnectIntegrationDto.prototype, "credentials", void 0);
/** Per-provider credential field hints for UI */
exports.INTEGRATION_CREDENTIAL_FIELDS = {
    META_ADS: [
        { key: 'appId', label: 'App ID' },
        { key: 'appSecret', label: 'App Secret', type: 'password' },
        { key: 'accessToken', label: 'Access Token', type: 'password' },
    ],
    GOOGLE_ADS: [
        { key: 'clientId', label: 'Client ID' },
        { key: 'clientSecret', label: 'Client Secret', type: 'password' },
        { key: 'developerToken', label: 'Developer Token', type: 'password' },
    ],
    ZALO_OA: [
        { key: 'oaId', label: 'OA ID' },
        { key: 'secretKey', label: 'Secret Key', type: 'password' },
    ],
    SMS: [
        { key: 'apiKey', label: 'API Key', type: 'password' },
        { key: 'brandName', label: 'Brand name' },
    ],
    EMAIL: [
        { key: 'smtpHost', label: 'SMTP Host' },
        { key: 'smtpUser', label: 'SMTP User' },
        { key: 'smtpPassword', label: 'SMTP Password', type: 'password' },
    ],
};

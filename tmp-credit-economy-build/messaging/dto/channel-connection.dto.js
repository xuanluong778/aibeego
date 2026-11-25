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
exports.ReconnectChannelDto = exports.PauseChannelDto = exports.ConnectZbsChannelDto = exports.ConnectZaloChannelDto = exports.ConnectMessengerChannelDto = void 0;
const class_validator_1 = require("class-validator");
class ConnectMessengerChannelDto {
    pageId;
    pageAccessToken;
    pageName;
    subscribeWebhook;
}
exports.ConnectMessengerChannelDto = ConnectMessengerChannelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConnectMessengerChannelDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], ConnectMessengerChannelDto.prototype, "pageAccessToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectMessengerChannelDto.prototype, "pageName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ConnectMessengerChannelDto.prototype, "subscribeWebhook", void 0);
class ConnectZaloChannelDto {
    oaId;
    accessToken;
    oaName;
    webhookSecret;
}
exports.ConnectZaloChannelDto = ConnectZaloChannelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConnectZaloChannelDto.prototype, "oaId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], ConnectZaloChannelDto.prototype, "accessToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloChannelDto.prototype, "oaName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloChannelDto.prototype, "webhookSecret", void 0);
class ConnectZbsChannelDto {
    appId;
    secretKey;
    accessToken;
    accountRef;
    displayName;
}
exports.ConnectZbsChannelDto = ConnectZbsChannelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZbsChannelDto.prototype, "appId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZbsChannelDto.prototype, "secretKey", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZbsChannelDto.prototype, "accessToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZbsChannelDto.prototype, "accountRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZbsChannelDto.prototype, "displayName", void 0);
class PauseChannelDto {
    isPaused;
}
exports.PauseChannelDto = PauseChannelDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PauseChannelDto.prototype, "isPaused", void 0);
class ReconnectChannelDto {
    credentials;
}
exports.ReconnectChannelDto = ReconnectChannelDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ReconnectChannelDto.prototype, "credentials", void 0);

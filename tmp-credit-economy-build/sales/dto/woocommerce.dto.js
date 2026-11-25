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
exports.WooDraftDto = exports.WooCategoryUrlDto = exports.WooBrowseDto = exports.WooConnectionDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class WooConnectionDto {
    websiteUrl;
    consumerKey;
    consumerSecret;
}
exports.WooConnectionDto = WooConnectionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], WooConnectionDto.prototype, "websiteUrl", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^ck_[a-f0-9]{40}$/),
    __metadata("design:type", String)
], WooConnectionDto.prototype, "consumerKey", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^cs_[a-f0-9]{40}$/),
    __metadata("design:type", String)
], WooConnectionDto.prototype, "consumerSecret", void 0);
class WooBrowseDto {
    page = 1;
    categoryId;
}
exports.WooBrowseDto = WooBrowseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Object)
], WooBrowseDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], WooBrowseDto.prototype, "categoryId", void 0);
class WooCategoryUrlDto {
    url;
}
exports.WooCategoryUrlDto = WooCategoryUrlDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], WooCategoryUrlDto.prototype, "url", void 0);
class WooDraftDto {
    clientToken;
    productIds;
}
exports.WooDraftDto = WooDraftDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], WooDraftDto.prototype, "clientToken", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    __metadata("design:type", Array)
], WooDraftDto.prototype, "productIds", void 0);

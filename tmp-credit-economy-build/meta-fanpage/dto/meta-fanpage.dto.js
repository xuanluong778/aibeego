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
exports.CreateMetaFanpagePostDto = void 0;
const class_validator_1 = require("class-validator");
class CreateMetaFanpagePostDto {
    message;
    link;
    imageUrl;
}
exports.CreateMetaFanpagePostDto = CreateMetaFanpagePostDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Nội dung bài đăng không được trống' }),
    (0, class_validator_1.MaxLength)(8000, { message: 'Nội dung tối đa 8000 ký tự' }),
    __metadata("design:type", String)
], CreateMetaFanpagePostDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => typeof v === 'string' && v.trim().length > 0),
    (0, class_validator_1.IsUrl)({ require_protocol: true }, { message: 'Link phải là URL hợp lệ (http/https)' }),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateMetaFanpagePostDto.prototype, "link", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => typeof v === 'string' && v.trim().length > 0),
    (0, class_validator_1.IsUrl)({ require_protocol: true }, { message: 'Ảnh phải là URL hợp lệ (http/https)' }),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateMetaFanpagePostDto.prototype, "imageUrl", void 0);

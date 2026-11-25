"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagKbModule = void 0;
const common_1 = require("@nestjs/common");
const rag_kb_controller_1 = require("./rag-kb.controller");
const rag_kb_service_1 = require("./rag-kb.service");
const rag_source_service_1 = require("./rag-source.service");
const rag_retrieval_service_1 = require("./rag-retrieval.service");
let RagKbModule = class RagKbModule {
};
exports.RagKbModule = RagKbModule;
exports.RagKbModule = RagKbModule = __decorate([
    (0, common_1.Module)({
        controllers: [rag_kb_controller_1.RagKbController],
        providers: [rag_kb_service_1.RagKbService, rag_source_service_1.RagSourceService, rag_retrieval_service_1.RagRetrievalService],
        exports: [rag_kb_service_1.RagKbService, rag_retrieval_service_1.RagRetrievalService],
    })
], RagKbModule);

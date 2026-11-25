"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QueueEnqueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEnqueueService = void 0;
const common_1 = require("@nestjs/common");
let QueueEnqueueService = QueueEnqueueService_1 = class QueueEnqueueService {
    logger = new common_1.Logger(QueueEnqueueService_1.name);
    async add(queue, name, data, opts) {
        if (!queue || typeof queue.add !== 'function') {
            this.logger.warn(`Queue missing for job ${name}`);
            return null;
        }
        return queue.add(name, data, opts);
    }
};
exports.QueueEnqueueService = QueueEnqueueService;
exports.QueueEnqueueService = QueueEnqueueService = QueueEnqueueService_1 = __decorate([
    (0, common_1.Injectable)()
], QueueEnqueueService);

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditContextInterceptor = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const node_crypto_1 = require("node:crypto");
const rxjs_1 = require("rxjs");
let CreditContextInterceptor = class CreditContextInterceptor {
    intercept(context, next) {
        if (context.getType() !== 'http')
            return next.handle();
        const request = context.switchToHttp().getRequest();
        const state = { organizationId: request.user?.organizationId,
            featureCode: (0, shared_1.creditFeatureForPath)(request.originalUrl || request.url || ''),
            referenceId: `ai:${(0, node_crypto_1.randomUUID)()}`, billingError: undefined };
        return new rxjs_1.Observable(subscriber => database_1.creditCallContext.run(state, () => {
            const subscription = next.handle().pipe((0, rxjs_1.tap)(() => {
                // Some legacy feature logic returns a fallback after catching provider errors.
                // Insufficient credit must still reach the client as an error.
                if (state.billingError)
                    throw state.billingError;
            })).subscribe(subscriber);
            return () => subscription.unsubscribe();
        }));
    }
};
exports.CreditContextInterceptor = CreditContextInterceptor;
exports.CreditContextInterceptor = CreditContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], CreditContextInterceptor);

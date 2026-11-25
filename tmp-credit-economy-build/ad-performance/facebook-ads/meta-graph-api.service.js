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
var MetaGraphApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaGraphApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MetaGraphApiService = MetaGraphApiService_1 = class MetaGraphApiService {
    config;
    logger = new common_1.Logger(MetaGraphApiService_1.name);
    constructor(config) {
        this.config = config;
    }
    get apiVersion() {
        return this.config.get('META_API_VERSION') ?? 'v21.0';
    }
    get appId() {
        const id = this.config.get('META_APP_ID');
        if (!id)
            throw new Error('META_APP_ID chưa cấu hình');
        return id;
    }
    get appSecret() {
        const secret = this.config.get('META_APP_SECRET');
        if (!secret)
            throw new Error('META_APP_SECRET chưa cấu hình');
        return secret;
    }
    get redirectUri() {
        return (this.config.get('META_REDIRECT_URI') ??
            `${this.config.get('API_URL') ?? 'http://localhost:4000'}/api/v1/ad-performance/facebook/oauth/callback`);
    }
    getOAuthScopes() {
        return ['ads_read', 'pages_read_engagement'];
    }
    buildOAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.appId,
            redirect_uri: this.redirectUri,
            state,
            scope: this.getOAuthScopes().join(','),
            response_type: 'code',
        });
        return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
    }
    async exchangeCodeForToken(code) {
        const params = new URLSearchParams({
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: this.redirectUri,
            code,
        });
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
    }
    async exchangeForLongLivedToken(shortLivedToken) {
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken,
        });
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
    }
    async getMe(accessToken) {
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/me`, accessToken);
    }
    async getAdAccounts(accessToken) {
        const data = await this.getJson(`https://graph.facebook.com/${this.apiVersion}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=100`, accessToken);
        return data.data ?? [];
    }
    async getCampaignInsights(accessToken, adAccountId, dateFrom, dateTo, campaignId) {
        const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const fields = [
            'campaign_id',
            'campaign_name',
            'objective',
            'spend',
            'impressions',
            'reach',
            'frequency',
            'cpm',
            'cpc',
            'ctr',
            'clicks',
            'actions',
            'cost_per_action_type',
            'purchase_roas',
            'action_values',
        ].join(',');
        const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });
        const params = new URLSearchParams({
            level: 'campaign',
            fields,
            time_range: timeRange,
            limit: '500',
        });
        if (campaignId) {
            params.set('filtering', JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: campaignId }]));
        }
        const url = `https://graph.facebook.com/${this.apiVersion}/${actId}/insights?${params.toString()}`;
        const data = await this.getJson(url, accessToken);
        return data.data ?? [];
    }
    async debugToken(accessToken) {
        const params = new URLSearchParams({
            input_token: accessToken,
            access_token: `${this.appId}|${this.appSecret}`,
        });
        const res = await this.getJson(`https://graph.facebook.com/${this.apiVersion}/debug_token?${params.toString()}`);
        return res.data;
    }
    async updateCampaignStatus(accessToken, campaignId, active) {
        const status = active ? 'ACTIVE' : 'PAUSED';
        const url = `https://graph.facebook.com/${this.apiVersion}/${campaignId}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, access_token: accessToken }),
        });
        const body = (await res.json());
        if (!res.ok || body.error) {
            const msg = body.error?.message ?? `Meta API error (${res.status})`;
            this.logger.warn(`Meta campaign status update failed: ${msg}`);
            throw new Error(msg);
        }
    }
    async getJson(url, accessToken) {
        const fullUrl = accessToken
            ? `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`
            : url;
        const res = await fetch(fullUrl);
        const body = (await res.json());
        if (!res.ok || body.error) {
            const msg = body.error?.message ?? `Meta API error (${res.status})`;
            this.logger.warn(`Meta API request failed: ${msg}`);
            throw new Error(msg);
        }
        return body;
    }
};
exports.MetaGraphApiService = MetaGraphApiService;
exports.MetaGraphApiService = MetaGraphApiService = MetaGraphApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MetaGraphApiService);

import { Body, Controller, Get, Header, Param, Post, Query, Req, Res, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LandingPagesService } from './landing-pages.service';
import { LandingPageTemplatePackService } from './landing-page-template-pack.service';
import {
  SubmitLandingPageLeadDto,
  TrackLandingPageEventDto,
} from './dto/landing-pages.dto';

/** Public landing pages — no JWT. Builder code is never loaded here. */
@Controller('landing-pages/public')
export class LandingPagesPublicController {
  constructor(
    private readonly service: LandingPagesService,
    private readonly templatePacks: LandingPageTemplatePackService,
  ) {}

  private clientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      const first = xf.split(',')[0]?.trim() || '';
      if (first) return first.slice(0, 64);
    }
    return (req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
  }

  /** Used only by the ingress/edge permission check; no draft or ownership token is exposed. */
  @Get('domains/resolve')
  @Header('Cache-Control', 'no-store')
  async resolveDomain(@Query('host') host: string, @Res({ passthrough: true }) res: Response) {
    const row = await this.service.resolveDomainHost(host);
    if (!row) throw new ForbiddenException('Tên miền chưa xác minh hoặc trang chưa xuất bản');
    res.setHeader('X-LP-Public-Key', row.publicKey);
    res.setHeader('X-LP-Page-Id', row.pageId);
    return { pageId: row.pageId, publicKey: row.publicKey };
  }

  @Get('domains/allow-certificate')
  @Header('Cache-Control', 'no-store')
  async allowCertificate(@Query('domain') domain: string) {
    const row = await this.service.resolveDomainHost(domain);
    if (!row) throw new ForbiddenException('Tên miền chưa đủ điều kiện cấp chứng chỉ');
    return { allowed: true };
  }

  /** Published HTML source is public. Draft HTML requires the asset key. */
  @Get('template-html/:templateId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: data:; img-src 'self' https: data: blob:; font-src https: data:; media-src https: data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'")
  @Header('Cache-Control', 'private, no-cache')
  templateHtml(@Param('templateId') templateId: string, @Query('k') key?: string) {
    return this.templatePacks.openPublicHtml(templateId, key);
  }

  /** Draft images require the unguessable key. Published images are public. */
  @Get('template-assets/:templateId/:file')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, max-age=300')
  templateAsset(
    @Param('templateId') templateId: string,
    @Param('file') file: string,
    @Query('k') key?: string,
  ) {
    return this.templatePacks.openPublicAsset(templateId, file, key);
  }

  /** Draft preview by opaque token — must be registered before :slug. */
  @Get('preview/:token')
  getByPreviewToken(@Param('token') token: string, @Req() req: Request) {
    return this.service.getPublicByPreviewToken(token, this.clientIp(req));
  }

  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Query('organizationId') organizationId?: string,
    @Req() req?: Request,
  ) {
    // Internal SSR uses a binding-specific key. Browser requests are scoped by Host.
    const org = slug.startsWith('lp-domain-') ? organizationId : await this.service.domainOrganization(req?.headers.host || '', slug, organizationId);
    return this.service.getPublicBySlug(slug, org);
  }

  @Post(':slug/lead')
  async submitLead(
    @Param('slug') slug: string,
    @Body() dto: SubmitLandingPageLeadDto,
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.service.domainOrganization(req.headers.host || '', slug, organizationId);
    return this.service.submitPublicLead(slug, dto, this.clientIp(req), org);
  }

  @Post(':slug/events')
  async trackEvent(
    @Param('slug') slug: string,
    @Body() dto: TrackLandingPageEventDto,
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.service.domainOrganization(req.headers.host || '', slug, organizationId);
    return this.service.trackPublicEvent(slug, dto, this.clientIp(req), org);
  }
}

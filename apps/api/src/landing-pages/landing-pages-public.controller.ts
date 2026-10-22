import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LandingPagesService } from './landing-pages.service';
import {
  SubmitLandingPageLeadDto,
  TrackLandingPageEventDto,
} from './dto/landing-pages.dto';

/** Public landing pages — no JWT. Builder code is never loaded here. */
@Controller('landing-pages/public')
export class LandingPagesPublicController {
  constructor(private readonly service: LandingPagesService) {}

  private clientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      const first = xf.split(',')[0]?.trim() || '';
      if (first) return first.slice(0, 64);
    }
    return (req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
  }

  /** Draft preview by opaque token — must be registered before :slug. */
  @Get('preview/:token')
  getByPreviewToken(@Param('token') token: string, @Req() req: Request) {
    return this.service.getPublicByPreviewToken(token, this.clientIp(req));
  }

  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.service.getPublicBySlug(slug, organizationId);
  }

  @Post(':slug/lead')
  submitLead(
    @Param('slug') slug: string,
    @Body() dto: SubmitLandingPageLeadDto,
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.service.submitPublicLead(slug, dto, this.clientIp(req), organizationId);
  }

  @Post(':slug/events')
  trackEvent(
    @Param('slug') slug: string,
    @Body() dto: TrackLandingPageEventDto,
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.service.trackPublicEvent(slug, dto, this.clientIp(req), organizationId);
  }
}

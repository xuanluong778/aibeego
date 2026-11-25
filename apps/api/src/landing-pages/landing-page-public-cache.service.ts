import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  landingPagePublicCacheTags,
  signLandingPageCacheRetryToken,
  verifyLandingPageCacheRetryToken,
} from '@marketingspa/shared';

export type LandingPageCacheRefreshResult = {
  ok: boolean;
  attempts: number;
  skipped?: boolean;
  reason?: string;
};

@Injectable()
export class LandingPagePublicCacheService {
  private readonly logger = new Logger(LandingPagePublicCacheService.name);

  constructor(private readonly config: ConfigService) {}

  private webBase(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      ''
    ).replace(/\/$/, '');
  }

  private secret(): string {
    return (
      this.config.get<string>('LANDING_PAGE_REVALIDATE_SECRET') ||
      this.config.get<string>('LP_REVALIDATE_SECRET') ||
      ''
    ).trim();
  }

  async refreshAfterPublication(input: {
    organizationId: string;
    pageId: string;
    slug: string;
  }): Promise<LandingPageCacheRefreshResult> {
    const web = this.webBase();
    const secret = this.secret();
    if (!web || !secret) {
      return { ok: false, attempts: 0, skipped: true, reason: 'revalidate_not_configured' };
    }
    const body = {
      organizationId: input.organizationId,
      pageId: input.pageId,
      slug: input.slug,
    };
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${web}/api/landing-pages/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok) {
          return { ok: true, attempts: attempt };
        }
        this.logger.warn(
          `LP cache refresh HTTP ${res.status} (attempt ${attempt}/${maxAttempts}) page=${input.pageId}`,
        );
      } catch (e) {
        this.logger.warn(
          `LP cache refresh failed (attempt ${attempt}/${maxAttempts}) page=${input.pageId}: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
    return { ok: false, attempts: maxAttempts, reason: 'revalidate_failed' };
  }

  issueRetryToken(scope: { organizationId: string; pageId: string; slug: string }): string | null {
    const secret = this.secret();
    if (!secret) return null;
    return signLandingPageCacheRetryToken(scope, secret);
  }

  verifyRetryToken(token: string) {
    const secret = this.secret();
    if (!secret) {
      return { ok: false as const, reason: 'revalidate_not_configured' as const };
    }
    return verifyLandingPageCacheRetryToken(token, secret);
  }
}
"use client";
import { useState, useEffect } from "react";
import {
  LANDING_PAGE_SYSTEM_TEMPLATES,
  type LandingPageSpec,
} from "@marketingspa/shared";
import { LandingPageRenderer } from "@/components/landing-pages/landing-page-renderer";
import { LandingPagePreviewViewport } from "@/components/landing-pages/landing-page-preview-viewport";
const repro = structuredClone(
  LANDING_PAGE_SYSTEM_TEMPLATES.find(
    (t) => t.slug === "agency-portfolio-cream-editorial",
  )!.spec,
);
const lead = repro.blocks.find((b) => b.type === "LeadForm")!;
repro.blocks = [
  {
    id: "reg-countdown",
    type: "Countdown",
    enabled: true,
    endsAt: "2030-01-01T00:00:00Z",
    headline: "Đăng ký ngay hôm nay — giảm 50%",
    price: "2.500.000 ₫",
    originalPrice: "5.000.000 ₫",
    styleVariant: "boxes",
    style: {
      customCss:
        "float:var(--lp-registration-float,left);width:var(--lp-registration-width,50%);zoom:var(--lp-registration-scale,1.34)",
    },
  } as any,
  {
    ...lead,
    style: {
      ...lead.style,
      customCss:
        "float:var(--lp-registration-float,left);width:var(--lp-registration-width,50%)",
    },
  },
];
export default function Qa() {
  const [state, setState] = useState({
    slug: "agency-portfolio-cream-editorial",
    width: 390,
    viewport: "mobile" as "mobile" | "tablet" | "desktop",
    preview: true,
    version: 0,
  });
  useEffect(() => {
    (window as any).__lpAudit = {
      catalog: LANDING_PAGE_SYSTEM_TEMPLATES.map((t) => ({
        slug: t.slug,
        category: t.category,
      })),
      render: (next: any) =>
        setState((s) => ({ ...s, ...next, version: s.version + 1 })),
    };
  }, []);
  let spec =
    state.slug === "draft"
      ? (repro as unknown as LandingPageSpec)
      : (LANDING_PAGE_SYSTEM_TEMPLATES.find((t) => t.slug === state.slug) ||
          LANDING_PAGE_SYSTEM_TEMPLATES[0])!.spec;
  if (state.slug.startsWith("clock:")) {
    spec = structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES[0]!.spec);
    spec.blocks = [
      {
        id: "qa-clock",
        type: "Countdown",
        enabled: true,
        endsAt: "2030-01-01T00:00:00Z",
        headline: "Đếm ngược đến ngày ra mắt",
        subheadline: "Đăng ký để nhận thông báo khi khóa học ra mắt.",
        styleVariant: state.slug.slice(6),
        price: "2.500.000 ₫",
        originalPrice: "5.000.000 ₫",
        ctaLabel: "Đăng ký ngay hôm nay — giảm 50%",
      } as any,
    ];
  }
  const body = (
    <LandingPageRenderer
      spec={spec}
      viewport={state.viewport}
      mode={state.preview ? "preview" : "public"}
      interactive={state.preview}
    />
  );
  return (
    <div
      data-qa-version={state.version}
      data-qa-slug={state.slug}
      style={{ width: state.width, margin: "0 auto" }}
    >
      {state.preview ? (
        <LandingPagePreviewViewport>{body}</LandingPagePreviewViewport>
      ) : (
        <div data-lp-public-root>{body}</div>
      )}
    </div>
  );
}

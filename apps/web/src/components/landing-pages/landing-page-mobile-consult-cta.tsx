'use client';
import { useEffect, useState } from 'react';

/** A navigation shortcut only. Never submits, reserves a place, or claims a discount. */
export function LandingPageMobileConsultCta({ formBlockId }: { formBlockId: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => {
      const form = document.getElementById('lead-form');
      const section = form?.closest('[data-lp-block-id]');
      const rect = section?.getBoundingClientRect();
      setHidden(!!form?.contains(document.activeElement) || !!(rect && rect.top < innerHeight && rect.bottom > 0));
    };
    const focus = () => { requestAnimationFrame(update); };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    update();
    return () => {
      window.removeEventListener('scroll', update); window.removeEventListener('resize', update);
      document.removeEventListener('focusin', focus); document.removeEventListener('focusout', focus);
    };
  }, [formBlockId]);
  return <>
    <style>{`
      [data-lp-mobile-consult-cta]{display:none}
      @media(max-width:767px){
        [data-lp-mobile-consult-cta]:not([hidden]){display:flex;position:fixed;inset:auto 0 0;z-index:40;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #d7dfde;box-shadow:0 -4px 20px #123a4210}
        [data-lp-mobile-consult-cta] a{display:block;width:100%;min-height:48px;padding:13px 16px;border-radius:10px;background:#123a42;color:#fff;text-align:center;font:700 15px/22px system-ui,sans-serif;text-decoration:none}
        main:has(>[data-lp-mobile-consult-cta]){padding-bottom:84px}
      }
    `}</style>
    <nav aria-label="Tư vấn khóa học" data-lp-mobile-consult-cta="1" hidden={hidden}>
      <a href="#lead-form" onClick={event => {
        const target = document.getElementById('lead-form');
        if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }}>Nhận tư vấn lộ trình học →</a>
    </nav>
  </>;
}

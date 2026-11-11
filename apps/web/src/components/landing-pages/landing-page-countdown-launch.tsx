'use client';

import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { LandingPageCountdownBlock } from '@marketingspa/shared';
import {
  countdownPresetById,
  isCountdownLaunchStyle,
} from '@marketingspa/shared';
import {
  InlineEditable,
  type LandingPageCanvasHandlers,
} from './landing-page-canvas-ux';
import { LandingPageCountdownLive } from './landing-page-countdown';
import './landing-page-countdown.css';

const COUNTDOWN_FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Share+Tech+Mono&display=swap';

let fontsInjected = false;
function ensureCountdownFonts() {
  if (typeof document === 'undefined' || fontsInjected) return;
  if (document.getElementById('lp-countdown-fonts')) {
    fontsInjected = true;
    return;
  }
  const link = document.createElement('link');
  link.id = 'lp-countdown-fonts';
  link.rel = 'stylesheet';
  link.href = COUNTDOWN_FONTS;
  document.head.appendChild(link);
  fontsInjected = true;
}

function tokenStyle(tokens: NonNullable<ReturnType<typeof countdownPresetById>>['tokens']): CSSProperties {
  return {
    ['--cd-bg' as string]: tokens.bg,
    ['--cd-bg-image' as string]: tokens.bgImage || 'none',
    ['--cd-bg-size' as string]: 'auto',
    ['--cd-text' as string]: tokens.text,
    ['--cd-muted' as string]: tokens.muted,
    ['--cd-accent' as string]: tokens.accent,
    ['--cd-digit' as string]: tokens.digit,
    ['--cd-form-bg' as string]: tokens.formBg,
    ['--cd-form-border' as string]: tokens.formBorder,
    ['--cd-form-radius' as string]: tokens.formRadius,
    ['--cd-input-bg' as string]: tokens.inputBg,
    ['--cd-input-border' as string]: tokens.inputBorder,
    ['--cd-input-color' as string]: tokens.inputColor,
    ['--cd-input-radius' as string]: tokens.inputRadius,
    ['--cd-cta-bg' as string]: tokens.ctaBg,
    ['--cd-cta-color' as string]: tokens.ctaColor,
    ['--cd-kicker' as string]: tokens.kicker,
    ['--cd-headline-font' as string]: tokens.headlineFont || 'inherit',
    ['--cd-digit-font' as string]: tokens.digitFont || 'inherit',
    backgroundColor: tokens.bg,
    backgroundImage: tokens.bgImage,
    backgroundSize: tokens.bgImage?.includes('linear-gradient(90deg') ? undefined : undefined,
    color: tokens.text,
  };
}

export function LandingPageCountdownLaunch({
  block,
  primary,
  canvas,
  onLeadSubmit,
  onFormStart,
}: {
  block: LandingPageCountdownBlock;
  primary: string;
  canvas?: LandingPageCanvasHandlers | null;
  onLeadSubmit?: (fields: Record<string, string>, blockId: string) => Promise<void> | void;
  onFormStart?: () => void;
}) {
  const preset = countdownPresetById(block.styleVariant);
  const tokens = preset?.tokens;
  const started = useRef(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof document !== 'undefined') ensureCountdownFonts();
  if (!tokens || !isCountdownLaunchStyle(block.styleVariant)) return null;

  const kicker = block.kicker || preset?.kicker || 'Aibeego';
  const formTitle = block.formHeadline || preset?.formHeadline || 'Đăng ký nhận thông báo';
  const submitLabel = block.submitLabel || preset?.submitLabel || 'Đăng ký ngay';
  const showForm = block.showSignup !== false;
  const blockStyle = (block.style || {}) as Record<string, unknown>;
  const cyanGrid = block.styleVariant === 'cyan-grid';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canvas) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const fields: Record<string, string> = {
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
    };
    if (!fields.name.trim() || !fields.email.trim()) {
      setError('Vui lòng điền họ tên và email.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onLeadSubmit?.(fields, block.id);
      setSuccess(true);
      form.reset();
    } catch {
      setError('Chưa gửi được. Thử lại giúp bạn.');
    } finally {
      setPending(false);
    }
  }

  const surface: CSSProperties = {
    ...tokenStyle(tokens),
    ...(cyanGrid ? { backgroundSize: '36px 36px' } : null),
  };

  return (
    <section
      className="lp-cd-launch"
      data-lp-countdown
      data-lp-countdown-launch="1"
      data-lp-countdown-theme={block.styleVariant}
      style={surface}
    >
      <div className="lp-cd-launch-inner" data-lp-container-inner="1">
        <div className="lp-cd-copy">
          {canvas ? (
            <InlineEditable
              as="div"
              blockId={block.id}
              field="kicker"
              value={kicker}
              handlers={canvas}
              blockStyle={blockStyle}
              textRole="paragraph"
              className="lp-cd-kicker"
            />
          ) : (
            <div className="lp-cd-kicker">{kicker}</div>
          )}
          {canvas ? (
            <InlineEditable
              as="h2"
              blockId={block.id}
              field="headline"
              value={block.headline || ''}
              handlers={canvas}
              blockStyle={blockStyle}
              textRole="heading"
              className="lp-cd-headline"
            />
          ) : (
            <h2 className="lp-cd-headline">{block.headline}</h2>
          )}
          {canvas ? (
            <InlineEditable
              as="p"
              blockId={block.id}
              field="subheadline"
              value={block.subheadline || ''}
              handlers={canvas}
              blockStyle={blockStyle}
              multiline
              textRole="paragraph"
              className="lp-cd-sub"
            />
          ) : (
            <p className="lp-cd-sub">{block.subheadline}</p>
          )}
          <LandingPageCountdownLive
            block={block}
            primary={primary}
            blockId={block.id}
            canvas={canvas}
          />
        </div>
        {showForm ? (
          <form
            className="lp-cd-form"
            data-lp-cd-form-theme={block.styleVariant}
            data-lp-countdown-form="1"
            onSubmit={onSubmit}
            onFocus={() => {
              if (!started.current) {
                started.current = true;
                onFormStart?.();
              }
            }}
          >
            {canvas ? (
              <InlineEditable
                as="h3"
                blockId={block.id}
                field="formHeadline"
                value={formTitle}
                handlers={canvas}
                blockStyle={blockStyle}
                textRole="heading"
                className="lp-cd-form-title"
              />
            ) : (
              <h3 className="lp-cd-form-title">{formTitle}</h3>
            )}
            {success ? (
              <p className="lp-cd-form-msg">Cảm ơn bạn! Chúng tôi sẽ thông báo khi ra mắt.</p>
            ) : (
              <>
                <label htmlFor={`${block.id}-cd-name`}>Họ và tên</label>
                <input
                  id={`${block.id}-cd-name`}
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Nguyễn Văn A"
                  readOnly={Boolean(canvas)}
                />
                <label htmlFor={`${block.id}-cd-email`}>Email</label>
                <input
                  id={`${block.id}-cd-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="ban@email.com"
                  readOnly={Boolean(canvas)}
                />
                <button type="submit" disabled={pending || Boolean(canvas)}>
                  {pending ? 'Đang gửi…' : submitLabel}
                </button>
                {error ? (
                  <p className="lp-cd-form-msg" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            )}
          </form>
        ) : null}
      </div>
    </section>
  );
}

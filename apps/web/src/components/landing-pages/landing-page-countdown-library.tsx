'use client';

import { LP_COUNTDOWN_PRESETS, type LandingPageCountdownLaunchStyle } from '@marketingspa/shared';

export function LandingPageCountdownLibrary({
  onSelect,
}: {
  onSelect: (id: LandingPageCountdownLaunchStyle) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white p-5 sm:p-6" data-lp-countdown-library="1">
      <p className="mb-4 text-sm text-zinc-600">
        Chọn một bộ hẹn giờ — mẫu sẽ được chèn vào landing page và vẫn chỉnh sửa được.
      </p>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        data-lp-countdown-library-grid="1"
        data-lp-countdown-library-count={LP_COUNTDOWN_PRESETS.length}
      >
        {LP_COUNTDOWN_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-lp-countdown-template={preset.id}
            className="group overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-sm transition hover:border-sky-500 hover:shadow-md"
            onClick={() => onSelect(preset.id)}
          >
            <span className="block aspect-[2/1] overflow-hidden bg-zinc-950">
              <img
                src={preset.thumb}
                alt={preset.label}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </span>
            <span className="block px-4 py-3">
              <strong className="block text-sm font-semibold text-zinc-900">{preset.label}</strong>
              <span className="mt-0.5 block text-xs text-zinc-500">{preset.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

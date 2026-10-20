import { useTheme } from '../store/StoreContext.jsx'

// How long the page-transition loader is shown when navigating (ms).
export const PAGE_LOAD_MS = 1800

// Exact hand-drawn stroke path from user reference video:
// Bridge -> Right Loop (clockwise) -> Center Crossing -> Left Loop (anticlockwise)
// Covers 100% of both loops and 3D bevels with zero uncovered pixels.
const LOOP_STROKE_PATH =
  'M 125 202 C 165 202 225 175 275 130 C 295 116 305 118 317 118 C 361 118 397 154 397 198 C 397 242 361 278 317 278 C 265 278 210 175 185 135 C 165 116 145 116 122 116 C 78 116 40 150 40 198 C 40 245 78 285 122 285 C 165 285 205 260 218 225'

// Mini signature 3D logo loader for sidebar navigation buttons:
export function LogoLoaderIcon({ className = 'h-5 w-auto' }) {
  return (
    <div
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: '28px', height: '20.7px' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 460 340"
        className="h-full w-full overflow-visible pointer-events-none"
      >
        <defs>
          <mask id="gl-mini-flow-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="460" height="340">
            <path
              d={LOOP_STROKE_PATH}
              fill="none"
              stroke="white"
              strokeWidth="86"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="gl-stroke-flow"
            />
            <rect
              x="0"
              y="0"
              width="460"
              height="340"
              fill="white"
              className="gl-mask-full-reveal"
            />
          </mask>
        </defs>

        <image
          href="/greenloop-loops-only.png"
          x="0"
          y="0"
          width="460"
          height="340"
          className="gl-loop-contrast-track"
        />

        <image
          href="/greenloop-loops-only.png"
          x="0"
          y="0"
          width="460"
          height="340"
          mask="url(#gl-mini-flow-mask)"
        />
      </svg>

      <img
        src="/greenloop-leaf-tight.png"
        alt=""
        className="gl-leaf-pop-bloom absolute pointer-events-none"
        style={{
          left: '76.3%',
          top: '4.7%',
          width: '20%',
          height: '23.8%',
        }}
      />
    </div>
  )
}

// Original three-chasing-arrows recycling glyph (preserved for utility/fallback)
export function RecycleIcon({ className = '', strokeWidth = 2.2 }) {
  const arrow = (
    <g>
      <path d="M12 4 A8 8 0 0 1 19.97 12.7" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <polygon points="19.78,14.89 21.96,12.87 17.98,12.53" fill="currentColor" />
    </g>
  )
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {arrow}
      <g transform="rotate(120 12 12)">{arrow}</g>
      <g transform="rotate(240 12 12)">{arrow}</g>
    </svg>
  )
}

// Full content-area loader: Frameless floating original 3D logo with exact video hand-drawn flow
// and blooming leaf appearance
export function PageLoader({ label }) {
  const { theme } = useTheme()
  return (
    <div
      className="animate-fade-slide flex h-full min-h-[60vh] flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-64 w-96 items-center justify-center">
        {/* Dynamic expanding concentric aura rings */}
        <span
          className="gl-halo-ring-1 absolute h-72 w-72 rounded-full opacity-60 blur-2xl"
          style={{ background: theme.progressGradient }}
        />
        <span
          className="gl-halo-ring-2 absolute h-52 w-52 rounded-full opacity-40 blur-xl"
          style={{ background: theme.progressGradient }}
        />

        {/* Frameless Floating GreenLoop Signature Composite */}
        <div
          className="gl-loader-float-gentle relative z-10 select-none drop-shadow-[0_16px_36px_rgba(5,150,105,0.35)]"
          style={{ width: '280px', height: '207px' }}
        >
          <svg
            viewBox="0 0 460 340"
            className="h-full w-full overflow-visible pointer-events-none"
          >
            <defs>
              <mask id="gl-main-flow-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="460" height="340">
                <path
                  d={LOOP_STROKE_PATH}
                  fill="none"
                  stroke="white"
                  strokeWidth="86"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="gl-stroke-flow"
                />
                <rect
                  x="0"
                  y="0"
                  width="460"
                  height="340"
                  fill="white"
                  className="gl-mask-full-reveal"
                />
              </mask>
            </defs>

            {/* Base Layer: Sleek contrast metallic silver outline of the loop */}
            <image
              href="/greenloop-loops-only.png"
              x="0"
              y="0"
              width="460"
              height="340"
              className="gl-loop-contrast-track"
            />

            {/* Top Layer: Rich vibrant 3D glossy gradient revealed by the liquid flow */}
            <image
              href="/greenloop-loops-only.png"
              x="0"
              y="0"
              width="460"
              height="340"
              mask="url(#gl-main-flow-mask)"
            />
          </svg>

          {/* Signature Sprouting Leaf: Blooms organically right after the loop finishes */}
          <img
            src="/greenloop-leaf-tight.png"
            alt="GreenLoop Sprouting Leaf"
            className="gl-leaf-pop-bloom absolute pointer-events-none select-none"
            style={{
              left: '76.3%',
              top: '4.7%',
              width: '20.0%',
              height: '23.8%',
            }}
          />
        </div>
      </div>

      <div className="text-center">
        <p className="text-lg font-bold text-slate-900 tracking-tight">Loading {label}…</p>
        <p className="text-sm font-medium text-slate-500">Preparing GreenLoop Ecosystem</p>
      </div>
    </div>
  )
}

/**
 * TrishClean SVG Logo — inline, dùng currentColor để tự match theme.
 * Concept: broom + sparkle stars, gradient accent.
 */
export function Logo({ size = 28 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trishclean-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="trishclean-bristle" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="16" cy="16" r="15" fill="url(#trishclean-grad)" opacity="0.12" />

      {/* Broom handle (diagonal stroke) */}
      <path
        d="M22 6 L11 19"
        stroke="url(#trishclean-grad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Broom head (trapezoid bristles) */}
      <path
        d="M11 19 L8 26 L15 26 L13.5 19.8 Z"
        fill="url(#trishclean-bristle)"
      />
      {/* Bristles lines */}
      <path
        d="M9.5 21.5 L9 25.5 M11.2 22 L11 25.7 M13 22.3 L13.4 25.7"
        stroke="#fff"
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Sparkle stars (clean effect) */}
      <g fill="#06b6d4">
        {/* Big sparkle top-right */}
        <path d="M24 8 L24.6 9.4 L26 10 L24.6 10.6 L24 12 L23.4 10.6 L22 10 L23.4 9.4 Z" opacity="0.85" />
        {/* Small sparkle */}
        <circle cx="26.5" cy="14" r="1.2" opacity="0.7" />
        <circle cx="20" cy="11" r="0.7" opacity="0.55" />
        {/* Bottom sparkle */}
        <path d="M21 22 L21.3 22.7 L22 23 L21.3 23.3 L21 24 L20.7 23.3 L20 23 L20.7 22.7 Z" opacity="0.65" />
      </g>
    </svg>
  );
}

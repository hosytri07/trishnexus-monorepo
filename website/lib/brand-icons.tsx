/**
 * Brand Icons — bộ SVG logo của các ứng dụng/dịch vụ bên ngoài mà user TT
 * hay dùng song song với hệ sinh thái. Dùng trong ExternalAppsWidget.
 *
 * LƯU Ý TRADEMARK:
 * Các SVG ở đây là geometric recreation đơn giản của các brand logo phổ biến.
 * Tên + hình dạng là tài sản của chủ sở hữu — dùng theo nominative fair use.
 * Khi cần brand reproduction chính xác: install @thesvg/react
 * (`npm i @thesvg/react`) rồi import { Github, Figma, ... } from '@thesvg/react'.
 *
 * Export:
 *   BRANDS  — object { slug: Component }
 *   BrandIconProps — { size?, className?, style? }
 */
import type { CSSProperties } from 'react';

export type BrandIconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

const defaultProps = (p: BrandIconProps = {}) => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  className: p.className,
  style: p.style,
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
});

/* ============================================================
 * GitHub — rounded square + white "G" simplified octocat body
 * ============================================================ */
export function GithubIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#181717" />
      <path
        d="M12 5.5c-3.6 0-6.5 2.9-6.5 6.5 0 2.87 1.86 5.3 4.44 6.16.32.06.44-.14.44-.31v-1.19c-1.8.4-2.18-.77-2.18-.77-.3-.75-.73-.95-.73-.95-.6-.4.04-.4.04-.4.66.05.99.68.99.68.58 1 1.52.71 1.89.54.06-.42.23-.71.42-.87-1.44-.16-2.96-.72-2.96-3.2 0-.71.25-1.29.67-1.75-.07-.16-.3-.82.07-1.71 0 0 .55-.17 1.78.66.52-.14 1.06-.21 1.6-.21s1.1.07 1.62.21c1.23-.83 1.77-.66 1.77-.66.36.9.13 1.55.07 1.71.42.46.66 1.04.66 1.75 0 2.5-1.52 3.04-2.97 3.2.24.2.44.6.44 1.21v1.79c0 .17.12.37.45.31 2.57-.86 4.43-3.29 4.43-6.16C18.5 8.4 15.6 5.5 12 5.5z"
        fill="#fff"
      />
    </svg>
  );
}

/* ============================================================
 * Google Drive — tri-color triangle
 * ============================================================ */
export function GoogleDriveIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#fff" />
      <path d="M7.71 4L3 12.23h5.42L13.13 4z" fill="#FFCE47" />
      <path d="M8.42 12.23L5.71 17h10.58L19 12.23z" fill="#3777E3" />
      <path d="M13.13 4l4.71 8.23L21 6.95 16.29 4z" fill="#11A861" />
    </svg>
  );
}

/* ============================================================
 * Dropbox — 4 stacked blue triangles
 * ============================================================ */
export function DropboxIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#0061FF" />
      <path d="M7.5 6.5L4 8.8l3.5 2.3 3.5-2.3zM16.5 6.5L13 8.8l3.5 2.3L20 8.8zM4 13.4l3.5 2.3L11 13.4 7.5 11.1zM13 13.4l3.5 2.3L20 13.4l-3.5-2.3z" fill="#fff" />
      <path d="M7.5 16.5l3.5 2.3 3.5-2.3L11 14.2z" fill="#fff" fillOpacity="0.85" />
    </svg>
  );
}

/* ============================================================
 * Figma — 3 circles + 2 squares iconic stack
 * ============================================================ */
export function FigmaIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#1e1e1e" />
      <circle cx="15" cy="12" r="2.5" fill="#1abcfe" />
      <path d="M9 14.5h3v-5H9a2.5 2.5 0 100 5z" fill="#0acf83" />
      <path d="M9 9.5h3v-5H9a2.5 2.5 0 100 5z" fill="#ff7262" />
      <path d="M12 9.5h3a2.5 2.5 0 100-5h-3v5z" fill="#f24e1e" />
      <path d="M9 19.5a2.5 2.5 0 002.5-2.5v-2.5H9a2.5 2.5 0 100 5z" fill="#a259ff" />
    </svg>
  );
}

/* ============================================================
 * Notion — N letter in white on black rounded square
 * ============================================================ */
export function NotionIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#e5e5e5" />
      <path
        d="M7 6.5l1.5-1 7 .5c.5 0 .7.2.7.6v10c0 .4-.2.6-.7.7l-7 .5-1.5-1V6.5z"
        fill="#000"
      />
      <path
        d="M9.5 9v6.5l.7.2v-5l3.5 5.2.5.1-.2-6.5h-.7l.1 4.5-3.4-5-.5.1z"
        fill="#fff"
      />
    </svg>
  );
}

/* ============================================================
 * Zalo — Vietnamese messaging; blue bubble with Z
 * ============================================================ */
export function ZaloIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#0068FF" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="11"
        fontWeight="900"
        fill="#fff"
        letterSpacing="-0.5"
      >
        Zalo
      </text>
    </svg>
  );
}

/* ============================================================
 * Chrome — circle với inner triangle (3 màu)
 * ============================================================ */
export function ChromeIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <circle cx="12" cy="12" r="10" fill="#fff" />
      <path d="M12 4a8 8 0 016.93 4H12a4 4 0 00-3.46 2L5.07 7.6A8 8 0 0112 4z" fill="#EA4335" />
      <path d="M4 12a8 8 0 014.54-7.22L12 10.54A4 4 0 008 12l-3.47 6A8 8 0 014 12z" fill="#FBBC04" />
      <path d="M20 12a8 8 0 01-8 8l3.46-6A4 4 0 0016 12h4z" fill="#34A853" />
      <circle cx="12" cy="12" r="3.2" fill="#4285F4" />
    </svg>
  );
}

/* ============================================================
 * Gmail — envelope with red M
 * ============================================================ */
export function GmailIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#fff" stroke="#ddd" />
      <path d="M2 7l10 7 10-7v12a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" fill="#EA4335" />
      <path d="M2 7v1l10 7 10-7V7l-10 6.5L2 7z" fill="#c5221f" />
    </svg>
  );
}

/* ============================================================
 * VSCode — blue angular mark
 * ============================================================ */
export function VSCodeIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#0078D4" />
      <path
        d="M16.5 4.5l-9 7-3-2-1 .8L6 12l-2.5 1.7 1 .8 3-2 9 7 2.5-1V5.5l-2.5-1zM16 8.5v7l-5-3.5 5-3.5z"
        fill="#fff"
      />
    </svg>
  );
}

/* ============================================================
 * YouTube — rounded red square with white play triangle
 * ============================================================ */
export function YoutubeIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect x="2" y="6" width="20" height="12" rx="3" fill="#FF0000" />
      <path d="M10 9.5v5l5-2.5-5-2.5z" fill="#fff" />
    </svg>
  );
}

/* ============================================================
 * ChatGPT — emerald circular mark
 * ============================================================ */
export function ChatGPTIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <circle cx="12" cy="12" r="10" fill="#10a37f" />
      <path
        d="M12 6.5a3 3 0 013 3v5a3 3 0 01-6 0v-5a3 3 0 013-3zm-2.5 4.5a.75.75 0 100 1.5.75.75 0 000-1.5zm5 0a.75.75 0 100 1.5.75.75 0 000-1.5z"
        fill="#fff"
        fillOpacity="0.95"
      />
    </svg>
  );
}

/* ============================================================
 * Slack — 4-color hashtag tiles
 * ============================================================ */
export function SlackIcon(p: BrandIconProps = {}) {
  return (
    <svg {...defaultProps(p)} fill="none">
      <rect width="24" height="24" rx="5" fill="#fff" />
      <rect x="9" y="4" width="3" height="8" rx="1.5" fill="#e01e5a" />
      <rect x="12" y="12" width="3" height="8" rx="1.5" fill="#ecb22e" />
      <rect x="4" y="9" width="8" height="3" rx="1.5" fill="#36c5f0" />
      <rect x="12" y="12" width="8" height="3" rx="1.5" fill="#2eb67d" />
    </svg>
  );
}

/* ============================================================
 * Registry — lookup by slug
 * ============================================================ */
export const BRANDS: Record<string, (p?: BrandIconProps) => JSX.Element> = {
  github: GithubIcon,
  googledrive: GoogleDriveIcon,
  dropbox: DropboxIcon,
  figma: FigmaIcon,
  notion: NotionIcon,
  zalo: ZaloIcon,
  chrome: ChromeIcon,
  gmail: GmailIcon,
  vscode: VSCodeIcon,
  youtube: YoutubeIcon,
  chatgpt: ChatGPTIcon,
  slack: SlackIcon,
};

export type BrandSlug = keyof typeof BRANDS;

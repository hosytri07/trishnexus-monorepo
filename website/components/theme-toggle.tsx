'use client';

/**
 * ThemeToggle — nút chuyển dark/light với animation sun/moon orb.
 *
 * Port từ FEZ-darkmode-toggle: track xanh ban ngày / xanh đêm, orb vàng (sun)
 * trượt sang đen (moon) có craters, mây ban ngày / sao + sao băng ban đêm.
 *
 * Connect với ThemeProvider của dự án — input.checked đồng bộ với `theme==='dark'`.
 * CSS styled-jsx scoped để không leak ra global.
 */
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <label
      className="tt-theme-switch"
      aria-label={`Chuyển sang theme ${isDark ? 'light' : 'dark'}`}
      title={isDark ? 'Đang: tối · Click để sáng' : 'Đang: sáng · Click để tối'}
    >
      <input
        type="checkbox"
        className="tt-theme-switch__input"
        checked={isDark}
        onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
      />

      <div className="tt-theme-switch__track">
        {/* Night */}
        <div className="tt-stars" aria-hidden="true" />
        <div className="tt-shooting-star" aria-hidden="true" />

        {/* Day */}
        <div className="tt-clouds" aria-hidden="true">
          <div className="tt-cloud tt-cloud--1" />
          <div className="tt-cloud tt-cloud--2" />
        </div>

        {/* Sun/Moon orb */}
        <div className="tt-orb" aria-hidden="true">
          <div className="tt-crater tt-crater--1" />
          <div className="tt-crater tt-crater--2" />
          <div className="tt-crater tt-crater--3" />
        </div>
      </div>

      <style jsx>{`
        /* ===== Sizing (giảm so FEZ gốc để vừa top nav) ===== */
        .tt-theme-switch {
          --tw: 64px;
          --th: 28px;
          --bezel: 3px;
          --track-w: calc(var(--tw) - var(--bezel) * 2);
          --track-h: calc(var(--th) - var(--bezel) * 2);
          --orb-size: calc(var(--track-h) - 4px);
          --orb-offset: 2px;
          --orb-travel: calc(
            var(--track-w) - var(--orb-size) - var(--orb-offset) * 2
          );

          --track-bg-light: #4ba5f8;
          --orb-bg-light: #fbbf24;
          --orb-glow-light: rgba(251, 191, 36, 0.7);
          --track-bg-dark: #12121f;
          --orb-bg-dark: #e2e8f0;
          --orb-glow-dark: rgba(226, 232, 240, 0.3);

          position: relative;
          display: inline-block;
          width: var(--tw);
          height: var(--th);
          cursor: pointer;
          border-radius: 999px;
          box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.2),
            inset 0 1px 2px rgba(255, 255, 255, 0.5);
          background: linear-gradient(145deg, #ffffff, #e6e6e6);
          transition: all 0.5s ease;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }

        /* Dark mode bezel */
        :global([data-theme='dark']) .tt-theme-switch {
          box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.5),
            inset 0 1px 2px rgba(255, 255, 255, 0.08);
          background: linear-gradient(145deg, #2a2a35, #15151c);
        }

        .tt-theme-switch__input {
          position: absolute;
          inset: 0;
          opacity: 0;
          margin: 0;
          cursor: pointer;
        }

        .tt-theme-switch__track {
          position: absolute;
          top: var(--bezel);
          left: var(--bezel);
          width: var(--track-w);
          height: var(--track-h);
          border-radius: 999px;
          background-color: var(--track-bg-light);
          overflow: hidden;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.25);
          transition: background-color 0.5s ease;
        }

        .tt-theme-switch__input:checked ~ .tt-theme-switch__track {
          background-color: var(--track-bg-dark);
        }

        /* Orb */
        .tt-orb {
          position: absolute;
          top: var(--orb-offset);
          left: var(--orb-offset);
          width: var(--orb-size);
          height: var(--orb-size);
          border-radius: 50%;
          background-color: var(--orb-bg-light);
          box-shadow:
            inset -2px -2px 4px rgba(180, 83, 9, 0.5),
            inset 2px 2px 3px rgba(255, 255, 255, 0.8),
            0 0 10px var(--orb-glow-light);
          transition:
            transform 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55),
            background-color 0.5s ease,
            box-shadow 0.5s ease;
          z-index: 20;
        }

        .tt-theme-switch__input:checked ~ .tt-theme-switch__track .tt-orb {
          transform: translateX(var(--orb-travel)) rotate(360deg);
          background-color: var(--orb-bg-dark);
          box-shadow:
            inset -2px -2px 4px rgba(0, 0, 0, 0.3),
            inset 2px 2px 3px rgba(255, 255, 255, 0.8),
            0 0 8px var(--orb-glow-dark);
        }

        /* Craters */
        .tt-crater {
          position: absolute;
          background-color: rgba(0, 0, 0, 0.18);
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.4s ease;
          box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.25);
        }
        .tt-crater--1 {
          top: 20%;
          left: 22%;
          width: 25%;
          height: 25%;
        }
        .tt-crater--2 {
          bottom: 22%;
          right: 22%;
          width: 18%;
          height: 18%;
        }
        .tt-crater--3 {
          top: 44%;
          right: 36%;
          width: 12%;
          height: 12%;
        }
        .tt-theme-switch__input:checked ~ .tt-theme-switch__track .tt-crater {
          opacity: 1;
        }

        /* Clouds */
        .tt-clouds {
          position: absolute;
          width: 100%;
          height: 100%;
          transition:
            transform 0.5s ease,
            opacity 0.4s ease;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
          z-index: 10;
        }
        .tt-cloud {
          position: absolute;
          background: #fff;
          border-radius: 50px;
        }
        .tt-cloud::before,
        .tt-cloud::after {
          content: '';
          position: absolute;
          background: #fff;
          border-radius: 50%;
        }
        .tt-cloud--1 {
          width: 16px;
          height: 6px;
          bottom: 18%;
          right: 12%;
          animation: tt-cloud-float 4s ease-in-out infinite;
        }
        .tt-cloud--1::before {
          width: 10px;
          height: 10px;
          top: -5px;
          left: 3px;
        }
        .tt-cloud--1::after {
          width: 7px;
          height: 7px;
          top: -3px;
          right: 2px;
        }
        .tt-cloud--2 {
          width: 12px;
          height: 5px;
          bottom: 38%;
          left: 34%;
          opacity: 0.7;
          animation: tt-cloud-float 5s ease-in-out infinite reverse;
        }
        .tt-cloud--2::before {
          width: 8px;
          height: 8px;
          top: -4px;
          left: 2px;
        }
        .tt-cloud--2::after {
          width: 6px;
          height: 6px;
          top: -2px;
          right: 2px;
        }
        .tt-theme-switch__input:checked ~ .tt-theme-switch__track .tt-clouds {
          transform: translateY(20px);
          opacity: 0;
        }

        /* Stars */
        .tt-stars {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          transform: translateY(-10px);
          transition: all 0.5s ease;
        }
        .tt-stars::before {
          content: '';
          position: absolute;
          background: #fff;
          border-radius: 50%;
          width: 1.5px;
          height: 1.5px;
          top: 25%;
          left: 55%;
          box-shadow:
            10px 4px #fff,
            20px 10px rgba(255, 255, 255, 0.6),
            -3px 8px #fff;
          animation: tt-twinkle 3s infinite alternate;
        }
        .tt-theme-switch__input:checked ~ .tt-theme-switch__track .tt-stars {
          opacity: 1;
          transform: translateY(0);
        }

        /* Shooting star */
        .tt-shooting-star {
          position: absolute;
          top: 18%;
          right: 22%;
          width: 18px;
          height: 1px;
          background: linear-gradient(to right, transparent, #fff);
          transform: rotate(-45deg) translateX(60px);
          opacity: 0;
        }
        .tt-theme-switch__input:checked ~ .tt-theme-switch__track .tt-shooting-star {
          animation: tt-shoot 5s infinite 2s;
        }

        @keyframes tt-cloud-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }
        @keyframes tt-twinkle {
          0% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes tt-shoot {
          0% {
            transform: rotate(-45deg) translateX(40px);
            opacity: 0;
          }
          5% {
            transform: rotate(-45deg) translateX(0);
            opacity: 1;
          }
          10% {
            transform: rotate(-45deg) translateX(-40px);
            opacity: 0;
          }
          100% {
            transform: rotate(-45deg) translateX(-40px);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tt-orb,
          .tt-clouds,
          .tt-stars {
            transition-duration: 0.2s;
          }
          .tt-cloud--1,
          .tt-cloud--2,
          .tt-stars::before,
          .tt-shooting-star {
            animation: none !important;
          }
        }
      `}</style>
    </label>
  );
}

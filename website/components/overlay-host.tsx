'use client';

/**
 * OverlayHost — wrapper client gom 3 overlay toàn cục:
 *   - <CommandPalette />   (Cmd/Ctrl+K)
 *   - <KeyboardHelp />     ("?")
 *   - <FocusMode />        ("F")
 *
 * Tại sao cần wrapper:
 *   - app/layout.tsx là server component → không dùng được useTheme().
 *   - CommandPalette cần biết theme hiện tại để đổi label "Chuyển sang Light/Dark mode"
 *     và gọi toggle() khi user chọn lệnh "Đổi theme".
 *   - OverlayHost chạy client-side, đọc context ThemeProvider và forward
 *     theme hook xuống CommandPalette.
 *
 * Đặt ngay dưới <ThemeProvider> trong layout.tsx.
 */
import { CommandPalette } from './command-palette';
import { KeyboardHelp } from './keyboard-help';
import { FocusMode } from './focus-mode';
import { useTheme } from './theme-provider';

export function OverlayHost() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <CommandPalette
        theme={{
          theme,
          toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
        }}
      />
      <KeyboardHelp />
      <FocusMode />
    </>
  );
}

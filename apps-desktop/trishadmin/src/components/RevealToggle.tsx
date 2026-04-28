/**
 * Phase 18.8.b — Nút eye 👁 / 🙈 toggle ẩn/hiện thông tin.
 *
 * Dùng 2 chỗ:
 * - Header panel: master toggle (label "Hiện tất cả" / "Ẩn tất cả")
 * - Per-row: nút icon nhỏ (chỉ icon, không label)
 */

interface Props {
  revealed: boolean;
  onToggle: () => void;
  variant?: 'inline' | 'header';
  showLabel?: boolean;
  /** Số row đang override khi ở variant header (hiển thị thông tin thêm) */
  overrideCount?: number;
  /** Disable khi panel chưa load xong */
  disabled?: boolean;
}

export function RevealToggle({
  revealed,
  onToggle,
  variant = 'inline',
  showLabel = false,
  overrideCount = 0,
  disabled = false,
}: Props): JSX.Element {
  const icon = revealed ? '🙈' : '👁';
  const labelText = revealed ? 'Ẩn tất cả' : 'Hiện tất cả';
  const titleText = revealed
    ? variant === 'header'
      ? 'Đang hiện. Bấm để ẩn tất cả.'
      : 'Đang hiện. Bấm để ẩn dòng này.'
    : variant === 'header'
      ? 'Đang ẩn. Bấm để hiện tất cả.'
      : 'Đang ẩn. Bấm để hiện dòng này.';

  return (
    <button
      type="button"
      className={`btn btn-sm btn-ghost reveal-toggle reveal-${variant}`}
      onClick={onToggle}
      title={titleText}
      aria-pressed={revealed}
      aria-label={titleText}
      disabled={disabled}
    >
      <span className="reveal-icon" aria-hidden="true">
        {icon}
      </span>
      {showLabel && <span className="reveal-label">{labelText}</span>}
      {variant === 'header' && overrideCount > 0 && (
        <span className="reveal-override-count" title={`${overrideCount} dòng đang khác master`}>
          ({overrideCount})
        </span>
      )}
    </button>
  );
}

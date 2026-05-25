# 🎨 Phase 45 — Design System Reference

> **Component library v1** cho hệ sinh thái TrishTEAM. Tất cả 4 app (Work / Utilities / Finance / Admin) dùng cùng components → UI đồng bộ, chỉ khác accent color theo `data-app`.

## 📦 Cài đặt + Import

Components đã export từ entry chính:

```tsx
import {
  // Layout
  AppCard, AppPageHeader, AppEmpty,
  // Action
  AppButton,
  // Form
  AppLabel, AppInput, AppSelect, AppTextarea, AppCheckbox,
  AppFormGroup, AppFieldset,
  // Data display
  AppTable, AppBadge, AppPill, AppTag,
  // Navigation
  AppSidebar, AppTabs,
  // Overlay
  AppModal,
  // App-level (Phase 44)
  AppShell, AppLogo, applyAppAccent, applyTheme,
} from '@trishteam/design-system';
```

## 🎨 Theming

Tất cả components tự đổi accent color theo `<html data-app="...">`:

| App | data-app | Accent |
|---|---|---|
| TrishWork | `work` | Xanh lá `#34D399` |
| TrishUtilities | `utilities` | Vàng `#FBBF24` |
| TrishFinance | `finance` | Xanh dương `#2563EB` |
| TrishAdmin | `admin` | Đỏ `#F87171` |

Components dùng CSS vars: `--color-accent-primary`, `--color-accent-soft`, `--color-text-primary`, `--color-surface-card`, etc.

## 📚 Component catalog

### AppCard — Container chuẩn
```tsx
<AppCard
  title="Dự án ATGT"
  subtitle="3 dự án đang mở"
  icon="🚸"
  actions={<AppButton size="sm">+ Mới</AppButton>}
  footer={<small>Cập nhật 5 phút trước</small>}
>
  Content
</AppCard>

<AppCard variant="ghost" padding="lg" hoverable onClick={...}>
  Clickable card
</AppCard>
```

**Variants:** `solid` (default) · `ghost` (no border) · `flat` (no shadow)
**Padding:** `sm` (12px) · `md` (18px default) · `lg` (24px)

### AppButton — Button 4 variant + 3 size
```tsx
<AppButton onClick={...}>Lưu</AppButton>                     // primary md
<AppButton variant="secondary" size="sm">Hủy</AppButton>
<AppButton variant="danger" loading={busy}>Xóa</AppButton>
<AppButton variant="ghost" icon="🔍" iconRight="↗">Tìm</AppButton>
<AppButton fullWidth size="lg">Đăng nhập</AppButton>
```

**Variants:** `primary` · `secondary` · `ghost` · `danger`
**Sizes:** `sm` · `md` · `lg`

### AppPageHeader — Header trên panel/page
```tsx
<AppPageHeader
  title="Quản lý người dùng"
  subtitle="Cấp quyền + xem session active"
  breadcrumb={['Admin', 'Users']}
  actions={
    <>
      <AppButton variant="secondary">Filter</AppButton>
      <AppButton>+ Thêm user</AppButton>
    </>
  }
  tabs={<AppTabs items={[...]} activeId={t} onChange={setT} />}
/>
```

### AppEmpty — Empty state
```tsx
<AppEmpty
  icon="📂"
  title="Chưa có hồ sơ nào"
  description="Tạo hồ sơ đầu tiên để bắt đầu khảo sát."
  action={<AppButton onClick={...}>+ Tạo hồ sơ</AppButton>}
/>
<AppEmpty size="sm" title="Không có kết quả" />
```

### Forms
```tsx
<AppFormGroup label="Email" required hint="Email công ty">
  <AppInput
    type="email"
    iconLeft="📧"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</AppFormGroup>

<AppFormGroup label="Vai trò">
  <AppSelect value={role} onChange={(e) => setRole(e.target.value)}>
    <option value="admin">Admin</option>
    <option value="user">User</option>
  </AppSelect>
</AppFormGroup>

<AppFormGroup label="Ghi chú">
  <AppTextarea rows={4} value={note} />
</AppFormGroup>

<AppCheckbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
  Ghi nhớ tài khoản
</AppCheckbox>

<AppFieldset legend="Thông tin liên hệ" description="Optional">
  <AppFormGroup label="Phone"><AppInput /></AppFormGroup>
  <AppFormGroup label="Address"><AppInput /></AppFormGroup>
</AppFieldset>
```

`AppFormGroup` hỗ trợ `layout="horizontal"` + `labelWidth={120}` cho form ngang.

### AppTable — Data table generic
```tsx
const cols: AppTableColumn<User>[] = [
  { key: 'email', label: 'Email', width: 240, sortable: true },
  {
    key: 'role',
    label: 'Vai trò',
    render: (u) => <AppBadge tone="success">{u.role}</AppBadge>,
  },
  {
    key: 'actions',
    label: '',
    align: 'right',
    render: (u) => <AppButton size="sm">Sửa</AppButton>,
  },
];

<AppTable
  data={users}
  columns={cols}
  keyField="id"
  density="normal"
  onRowClick={(user) => setSelected(user)}
  sortKey={sortKey}
  sortDir={sortDir}
  onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
  loading={loading}
  empty="Chưa có user nào"
/>
```

**Density:** `compact` (6px padding) · `normal` (10px default) · `comfortable` (14px)

### AppBadge / AppPill / AppTag
```tsx
<AppBadge tone="success">Active</AppBadge>
<AppBadge tone="warning" dot>3 chưa đọc</AppBadge>
<AppBadge tone="danger" variant="solid">Khẩn cấp</AppBadge>
<AppBadge variant="outline" tone="accent">v2.0</AppBadge>

<AppPill mono>v2.0.0</AppPill>        // monospace neutral chip
<AppPill>BETA</AppPill>

<AppTag tone="info">Filter: Admin</AppTag>
<AppTag tone="accent" onClose={() => removeTag()}>react × </AppTag>
```

**Tones:** `neutral` · `accent` · `info` · `success` · `warning` · `danger`

### AppSidebar — Vertical nav
```tsx
<AppSidebar
  activeId={active}
  onSelect={setActive}
  width={240}
  collapsed={false}
  header={<AppLogo appId="admin" />}
  footer={<UserMenu />}
  groups={[
    {
      label: 'Tổng quan',
      items: [{ id: 'dashboard', icon: '🏠', label: 'Dashboard' }],
    },
    {
      label: 'Người dùng',
      items: [
        { id: 'users', icon: '👥', label: 'Users', badge: '12' },
        { id: 'keys',  icon: '🔑', label: 'Keys' },
      ],
    },
  ]}
/>
```

### AppTabs — Tabs ngang/dọc
```tsx
<AppTabs
  items={[
    { id: 'all',     label: 'Tất cả', count: 24 },
    { id: 'active',  label: 'Đang hoạt động', count: 18, icon: '🟢' },
    { id: 'pending', label: 'Chờ duyệt', count: 6 },
  ]}
  activeId={tab}
  onChange={setTab}
  variant="underline"   // pill | underline | minimal
  size="md"
/>
```

### AppModal — Modal dialog
```tsx
<AppModal
  open={open}
  onClose={() => setOpen(false)}
  title="Sửa user"
  description="Cập nhật thông tin tài khoản"
  size="md"   // sm 380 · md 520 · lg 720 · xl 960
  footer={
    <>
      <AppButton variant="ghost" onClick={() => setOpen(false)}>Hủy</AppButton>
      <AppButton onClick={handleSave}>💾 Lưu</AppButton>
    </>
  }
>
  <AppFormGroup label="Tên hiển thị" required>
    <AppInput />
  </AppFormGroup>
  ...
</AppModal>
```

ESC + click backdrop → tự đóng. Body scroll lock khi mở.

## 🔧 Đã refactor sang components mới

| File | Status | Tác động |
|---|---|---|
| `packages/auth/src/login-screen.tsx` | ✅ 45.5 | 4 app dùng chung LoginScreen mới — hiện đẹp |
| `packages/auth/src/auth-gate.tsx` | ✅ 45.6 | Màn "Cần cấp quyền" của 4 app có card + badge role + spinner đẹp |
| `apps-desktop/trishadmin/src/components/AppAccessPanel.tsx` | ✅ 45.7 | Pilot: AppPageHeader + AppTable + AppInput + AppBadge + AppEmpty |

## ⏸ Defer (sẽ làm dần ở Phase 46+)

Các module sau VẪN DÙNG UI CŨ (chưa refactor sang components Phase 45):
- TrishWork: 3 module (Design / Library / ISO) — code 60k LoC, refactor 1 module/phiên
- TrishUtilities: 5 module (Clean / Check / Drive / Font / Shortcut)
- TrishFinance: main UI (chưa thay AppShell)
- TrishAdmin: các panel cũ (Users, Keys, Sessions, ...) — vẫn dùng inline style

UI cũ vẫn chạy được, KHÔNG break tính năng. Refactor dần để đẹp hơn.

## 🧪 Test components

Sau khi pull về:
1. Login screen (4 app) → thấy logo PNG + form đẹp + Google button có logo SVG
2. Vào màn "Cần cấp quyền" (user role trial) → thấy card đẹp + badge role + email info
3. TrishAdmin → sidebar "🔑 Cấp quyền App (Phase 44)" → bảng dùng AppTable + filter search + accent đúng app

/**
 * Phase 45 — Component library barrel export.
 *
 * Usage:
 *   import { AppCard, AppButton, AppTable, AppModal } from '@trishteam/design-system';
 *
 * Components đã chuẩn:
 *   45.1: AppCard, AppButton, AppPageHeader, AppEmpty
 *   45.2: AppLabel, AppInput, AppSelect, AppTextarea, AppCheckbox, AppFormGroup, AppFieldset
 *   45.3: AppTable, AppBadge, AppPill, AppTag
 *   45.4: AppSidebar, AppModal, AppTabs
 */

export { AppCard } from './AppCard.js';
export type { AppCardProps } from './AppCard.js';

export { AppButton } from './AppButton.js';
export type { AppButtonProps, AppButtonVariant, AppButtonSize } from './AppButton.js';

export { AppPageHeader } from './AppPageHeader.js';
export type { AppPageHeaderProps } from './AppPageHeader.js';

export { AppEmpty } from './AppEmpty.js';
export type { AppEmptyProps } from './AppEmpty.js';

export {
  AppLabel,
  AppInput,
  AppSelect,
  AppTextarea,
  AppCheckbox,
  AppFormGroup,
  AppFieldset,
} from './AppForm.js';
export type {
  AppLabelProps,
  AppInputProps,
  AppSelectProps,
  AppTextareaProps,
  AppCheckboxProps,
  AppFormGroupProps,
  AppFieldsetProps,
} from './AppForm.js';

export { AppTable } from './AppTable.js';
export type { AppTableProps, AppTableColumn } from './AppTable.js';

export { AppBadge, AppPill, AppTag } from './AppBadge.js';
export type { AppBadgeProps, AppBadgeTone, AppPillProps, AppTagProps } from './AppBadge.js';

export { AppSidebar } from './AppSidebar.js';
export type { AppSidebarProps, AppSidebarGroup, AppSidebarItem } from './AppSidebar.js';

export { AppModal } from './AppModal.js';
export type { AppModalProps } from './AppModal.js';

export { AppTabs } from './AppTabs.js';
export type { AppTabsProps, AppTabItem } from './AppTabs.js';

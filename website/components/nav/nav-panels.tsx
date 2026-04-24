'use client';

/**
 * NavPanels — các popover cho TopNav: Search · Notifications · User · Admin.
 *
 * Port từ FEZ-dashboard-navbar với kiến trúc React:
 *  - Mỗi panel có state open/close riêng, click outside để đóng, Escape để đóng.
 *  - Single source of truth: useState openPanel = 'search' | 'notif' | 'user' | null.
 *  - Role được đọc từ `useUserSession()`, show "Đăng nhập" nếu guest.
 *
 * Admin panel khác User panel ở menu items:
 *  - User:  Profile / Settings / Billing / Upgrade / Refer / Logout
 *  - Admin: Dashboard / Users / Announcements / Posts / Audit log / Logout
 *
 * Chưa có auth thật → có role switcher "Chế độ xem" để preview Guest/User/Admin.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  ChevronDown,
  Search,
  User,
  Settings,
  CreditCard,
  Sparkles,
  Gift,
  LogOut,
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  History,
  UserCheck,
  Shield,
  Sun,
} from 'lucide-react';
import { useUserSession, type UserRole } from '@/lib/user-session';

type PanelKey = 'search' | 'notif' | 'user' | null;

const NOTIFICATIONS = [
  {
    id: 1,
    icon: '🎉',
    kind: 'purple' as const,
    msg: 'Chào mừng đến với TrishTEAM! Phase 11.5 đã deploy.',
    time: 'Vừa xong',
    unread: true,
  },
  {
    id: 2,
    icon: '✅',
    kind: 'green' as const,
    msg: 'Thêm 3 card giá (Xăng / Vàng / Ngoại tệ) riêng biệt.',
    time: '2 phút trước',
    unread: true,
  },
  {
    id: 3,
    icon: '⚡',
    kind: 'amber' as const,
    msg: 'Tính năng mới: banner admin + navbar panel user/admin.',
    time: '1 giờ trước',
    unread: true,
  },
  {
    id: 4,
    icon: '🔒',
    kind: 'purple' as const,
    msg: 'Sắp ra: Firebase Auth + 2FA (Phase 11.6).',
    time: 'Hôm qua',
    unread: false,
  },
];

const RECENT_SEARCHES = [
  { label: 'Giá xăng hôm nay', sub: 'Widget tài chính' },
  { label: 'TrishFont v0.9', sub: 'Hệ sinh thái' },
  { label: 'Biển báo GTĐB', sub: 'Feature page' },
  { label: 'Góp ý', sub: 'Anchor #feedback' },
];

export function NavPanels() {
  const { user, role, setRole, isAdmin, isAuthenticated, logout } =
    useUserSession();
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);
  const [unreadCount, setUnreadCount] = useState(
    NOTIFICATIONS.filter((n) => n.unread).length
  );
  const [notifList, setNotifList] = useState(NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPanel(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function toggle(k: Exclude<PanelKey, null>) {
    setOpenPanel((prev) => (prev === k ? null : k));
  }

  function markAllRead() {
    setNotifList((list) => list.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  }

  function handleLogout() {
    setOpenPanel(null);
    logout();
  }

  const filteredSearches = searchQuery.trim()
    ? RECENT_SEARCHES.filter((r) =>
        r.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : RECENT_SEARCHES;

  return (
    <div
      ref={wrapperRef}
      className="nav-panels flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* SEARCH */}
      <div className="panel-wrap">
        <button
          type="button"
          className={`icon-btn ${openPanel === 'search' ? 'active' : ''}`}
          onClick={() => toggle('search')}
          aria-label="Tìm kiếm"
          aria-expanded={openPanel === 'search'}
        >
          <Search size={16} strokeWidth={2} />
        </button>
        <div className={`panel panel-search ${openPanel === 'search' ? 'open' : ''}`}>
          <div className="search-box">
            <Search size={14} strokeWidth={2} />
            <input
              type="text"
              placeholder="Tìm app, bài viết, note…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Ô tìm kiếm"
              autoFocus={openPanel === 'search'}
            />
            <kbd className="search-kbd">⌘K</kbd>
          </div>
          <div className="search-recents">
            <div className="section-label">
              {searchQuery ? 'Kết quả' : 'Gần đây'}
            </div>
            {filteredSearches.length > 0 ? (
              filteredSearches.map((r) => (
                <div key={r.label} className="search-item" role="button">
                  <div className="s-icon">
                    <Search size={13} strokeWidth={2} />
                  </div>
                  <div className="s-text">
                    <div className="s-label">{r.label}</div>
                    <div className="s-sub">{r.sub}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="search-empty">
                Không thấy kết quả cho "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="panel-wrap">
        <button
          type="button"
          className={`icon-btn ${openPanel === 'notif' ? 'active' : ''}`}
          onClick={() => toggle('notif')}
          aria-label="Thông báo"
          aria-expanded={openPanel === 'notif'}
        >
          {unreadCount > 0 && <span className="notif-dot" aria-hidden="true" />}
          <Bell size={16} strokeWidth={2} />
        </button>
        <div className={`panel panel-notif ${openPanel === 'notif' ? 'open' : ''}`}>
          <div className="notif-header">
            <span className="notif-title">Thông báo</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-clear"
                onClick={markAllRead}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifList.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.unread ? 'unread' : ''}`}
              >
                <div className={`n-icon n-${n.kind}`}>{n.icon}</div>
                <div className="n-body">
                  <div className="n-msg">{n.msg}</div>
                  <div className="n-time">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="notif-footer">
            Xem tất cả →
          </button>
        </div>
      </div>

      <div className="nav-divider" aria-hidden="true" />

      {/* PROFILE — switches between Login button and User/Admin panel */}
      {!isAuthenticated ? (
        <div className="flex items-center gap-2">
          <LoginButton />
          {/* Mock: guest cũng có thể preview user/admin */}
          <RoleSwitcher role={role} setRole={setRole} compact />
        </div>
      ) : (
        <div className="panel-wrap">
          <button
            type="button"
            className={`profile-trigger ${openPanel === 'user' ? 'active' : ''}`}
            onClick={() => toggle('user')}
            aria-label="Hồ sơ"
            aria-expanded={openPanel === 'user'}
          >
            <div className={`avatar ${isAdmin ? 'avatar-admin' : ''}`}>
              {user!.avatar_initials}
            </div>
            <span className="trigger-name">{user!.name.split(' ').pop()}</span>
            {isAdmin && (
              <span className="admin-badge" title="Admin">
                <Shield size={10} strokeWidth={2.5} />
              </span>
            )}
            <ChevronDown size={14} strokeWidth={2} className="chevron" />
          </button>

          <div
            className={`panel panel-profile ${openPanel === 'user' ? 'open' : ''}`}
          >
            <div className="panel-user">
              <div className={`panel-avatar ${isAdmin ? 'avatar-admin' : ''}`}>
                {user!.avatar_initials}
              </div>
              <div className="panel-user-info">
                <div className="panel-user-name">{user!.name}</div>
                <div className="panel-user-email">{user!.email}</div>
                <div className={`plan-badge ${isAdmin ? 'plan-admin' : ''}`}>
                  {isAdmin ? (
                    <Shield size={9} strokeWidth={2.5} />
                  ) : (
                    <Sparkles size={9} strokeWidth={2.5} />
                  )}
                  {user!.plan}
                </div>
              </div>
            </div>

            {isAdmin ? <AdminMenuItems /> : <UserMenuItems />}

            <div className="panel-divider" />

            <div className="panel-section">
              <div className="section-label">Chế độ xem (mock)</div>
              <RoleSwitcher role={role} setRole={setRole} />
            </div>

            <div className="panel-divider" />

            <div className="panel-section">
              <button
                type="button"
                className="menu-item danger"
                onClick={handleLogout}
              >
                <div className="item-icon">
                  <LogOut size={14} strokeWidth={2} />
                </div>
                <span className="item-text">
                  <span className="item-label">Đăng xuất</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .nav-panels {
          position: relative;
        }
        .panel-wrap {
          position: relative;
        }
        .icon-btn {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.18s, background 0.18s;
        }
        .icon-btn:hover {
          color: var(--color-text-primary);
          background: var(--color-surface-muted);
        }
        .icon-btn.active {
          color: var(--color-accent-primary);
          background: var(--color-accent-soft);
        }
        .notif-dot {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 7px;
          height: 7px;
          background: #ef4444;
          border-radius: 50%;
          border: 1.5px solid var(--color-surface-bg);
          pointer-events: none;
        }
        .nav-divider {
          width: 1px;
          height: 22px;
          background: var(--color-border-subtle);
          margin: 0 4px;
        }
        /* ------------------------------------------------------------------
         * Phase 11.5.19 rewrite — đơn giản hoá tối đa để tránh wrap:
         *   - display: inline-flex + flex-direction: row + flex-wrap: nowrap
         *     (explicit để không parent Tailwind nào override được)
         *   - Tất cả children: flex-shrink: 0 (icon + span không co)
         *   - span dùng inline + line-height: 1 + align-self: center
         *   - Bỏ wrapper __icon / __text classname, dùng child selector
         * ------------------------------------------------------------------ */
        .login-btn {
          display: inline-flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 34px;
          padding: 0 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: 0.01em;
          background: var(--color-accent-gradient);
          color: #fff;
          box-shadow:
            0 2px 8px rgba(74, 222, 128, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .login-btn > :global(svg) {
          flex-shrink: 0;
          display: block;
        }
        .login-btn > span {
          flex-shrink: 0;
          display: inline-block;
          line-height: 1;
          white-space: nowrap;
          /* Tiếng Việt: "Đ" và "g/p/ậ" ăn vào top/bottom — nudge 0.5px xuống
             cho cân optical với icon User (icon-based x-height center). */
          transform: translateY(0.5px);
        }
        .login-btn:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
          box-shadow:
            0 6px 16px rgba(74, 222, 128, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .login-btn:active {
          transform: translateY(0);
        }
        .profile-trigger {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 999px;
          border: 1px solid var(--color-border-subtle);
          background: transparent;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .profile-trigger:hover {
          border-color: var(--color-accent-primary);
          background: var(--color-surface-muted);
        }
        .profile-trigger.active {
          border-color: var(--color-accent-primary);
          background: var(--color-surface-muted);
          box-shadow: 0 0 0 3px var(--color-accent-soft);
        }
        .avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4ADE80, #10B981);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.5px;
        }
        .avatar-admin {
          background: linear-gradient(135deg, #f59e0b, #ef4444);
        }
        .trigger-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .admin-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }
        .chevron {
          color: var(--color-text-muted);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            color 0.2s;
        }
        .profile-trigger.active .chevron {
          transform: rotate(180deg);
          color: var(--color-accent-primary);
        }
        .panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-default);
          border-radius: 14px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45),
            0 0 0 1px var(--color-border-subtle);
          overflow: hidden;
          opacity: 0;
          transform: translateY(-10px) scale(0.97);
          transform-origin: top right;
          pointer-events: none;
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 50;
        }
        .panel.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .panel-search {
          width: 320px;
        }
        .panel-notif {
          width: 340px;
        }
        .panel-profile {
          width: 280px;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--color-border-subtle);
          color: var(--color-text-muted);
        }
        .search-box input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font: inherit;
          font-size: 13.5px;
          color: var(--color-text-primary);
        }
        .search-box input::placeholder {
          color: var(--color-text-muted);
        }
        .search-kbd {
          font-family: monospace;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--color-surface-muted);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border-subtle);
        }
        .search-recents {
          padding: 6px;
          max-height: 280px;
          overflow-y: auto;
        }
        .section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--color-text-muted);
          padding: 7px 10px 4px;
        }
        .search-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .search-item:hover {
          background: var(--color-surface-muted);
        }
        .s-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: var(--color-surface-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .s-text {
          min-width: 0;
        }
        .s-label {
          font-size: 13px;
          color: var(--color-text-primary);
        }
        .s-sub {
          font-size: 11px;
          color: var(--color-text-muted);
        }
        .search-empty {
          padding: 16px;
          text-align: center;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 14px 11px;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .notif-title {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .notif-clear {
          font-size: 11px;
          color: var(--color-accent-primary);
          cursor: pointer;
          background: none;
          border: none;
          transition: opacity 0.15s;
        }
        .notif-clear:hover {
          opacity: 0.7;
        }
        .notif-list {
          padding: 6px;
          max-height: 300px;
          overflow-y: auto;
        }
        .notif-list::-webkit-scrollbar {
          width: 4px;
        }
        .notif-list::-webkit-scrollbar-thumb {
          background: var(--color-border-default);
          border-radius: 4px;
        }
        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px;
          border-radius: 8px;
          position: relative;
          transition: background 0.15s;
          cursor: pointer;
        }
        .notif-item:hover {
          background: var(--color-surface-muted);
        }
        .notif-item.unread::after {
          content: '';
          position: absolute;
          top: 12px;
          right: 10px;
          width: 6px;
          height: 6px;
          background: var(--color-accent-primary);
          border-radius: 50%;
        }
        .n-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        .n-purple {
          background: var(--color-accent-soft);
        }
        .n-green {
          background: rgba(52, 211, 153, 0.12);
        }
        .n-amber {
          background: rgba(245, 158, 11, 0.12);
        }
        .n-body {
          flex: 1;
          min-width: 0;
        }
        .n-msg {
          font-size: 12.5px;
          color: var(--color-text-primary);
          line-height: 1.4;
        }
        .n-time {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }
        .notif-footer {
          width: 100%;
          padding: 10px 14px;
          border-top: 1px solid var(--color-border-subtle);
          text-align: center;
          font-size: 12px;
          color: var(--color-accent-primary);
          cursor: pointer;
          background: transparent;
          border-left: none;
          border-right: none;
          border-bottom: none;
          transition: opacity 0.15s;
        }
        .notif-footer:hover {
          opacity: 0.7;
        }
        .panel-user {
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 11px;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .panel-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4ADE80, #10B981);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          box-shadow: 0 0 14px var(--color-accent-soft);
          flex-shrink: 0;
        }
        .panel-user-info {
          min-width: 0;
        }
        .panel-user-name {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .panel-user-email {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 1px;
        }
        .plan-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 5px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .plan-admin {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .panel-divider {
          height: 1px;
          background: var(--color-border-subtle);
        }
        :global(.panel .panel-section) {
          padding: 6px;
        }
        :global(.panel .section-label) {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--color-text-muted);
          padding: 7px 10px 4px;
        }
        :global(.panel .menu-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          cursor: pointer;
          background: transparent;
          border: none;
          color: inherit;
          width: 100%;
          text-align: left;
          transition: background 0.15s, padding-left 0.15s;
        }
        :global(.panel .menu-item:hover) {
          background: var(--color-surface-muted);
          padding-left: 14px;
        }
        :global(.panel .menu-item.danger) {
          color: #f87171;
        }
        :global(.panel .menu-item.danger:hover) {
          background: rgba(239, 68, 68, 0.08);
        }
        :global(.panel .item-icon) {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          background: var(--color-surface-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--color-text-muted);
          transition: transform 0.15s;
        }
        :global(.panel .menu-item:hover .item-icon) {
          transform: scale(1.08);
        }
        :global(.panel .menu-item.danger .item-icon) {
          color: #f87171;
          background: rgba(239, 68, 68, 0.12);
        }
        :global(.panel .item-text) {
          flex: 1;
          min-width: 0;
        }
        :global(.panel .item-label) {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
        }
        :global(.panel .menu-item.danger .item-label) {
          color: #f87171;
        }
        :global(.panel .item-sub) {
          display: block;
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 1px;
        }
        :global(.panel .item-tag) {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 20px;
          flex-shrink: 0;
        }
        :global(.panel .tag-new) {
          background: var(--color-accent-soft);
          color: var(--color-accent-primary);
          border: 1px solid var(--color-border-default);
        }
        :global(.panel .tag-beta) {
          background: rgba(52, 211, 153, 0.12);
          color: #34d399;
          border: 1px solid rgba(52, 211, 153, 0.25);
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────
 * LOGIN BUTTON (Phase 11.5.24) — INLINE STYLES ONLY
 * ──────────────────────────────────────────────
 * Phase 11.5.11, 11.5.19 đều "fix" bằng styled-jsx nhưng user report
 * vẫn stack dọc. Lần này dùng inline style 100% — CSS specificity cao
 * nhất, không cache/cascade nào override được. Icon + text luôn nằm
 * ngang cạnh nhau.
 * ────────────────────────────────────────────── */
function LoginButton() {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const base: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '7px',
    height: '34px',
    padding: '0 16px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: '0.01em',
    background: 'var(--color-accent-gradient)',
    color: '#fff',
    boxShadow: hover
      ? '0 6px 16px rgba(74, 222, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.22)'
      : '0 2px 8px rgba(74, 222, 128, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
    transform: press ? 'translateY(0)' : hover ? 'translateY(-1px)' : 'translateY(0)',
    filter: hover ? 'brightness(1.05)' : 'none',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  return (
    <Link
      href="/login"
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
    >
      <User
        size={15}
        strokeWidth={2.25}
        aria-hidden="true"
        style={{ flexShrink: 0, display: 'block' }}
      />
      <span
        style={{
          flexShrink: 0,
          display: 'inline-block',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          transform: 'translateY(0.5px)',
        }}
      >
        Đăng nhập
      </span>
    </Link>
  );
}

/* ──────────────────────────────────────────────
 * USER MENU — Account + Subscription
 * ────────────────────────────────────────────── */
function UserMenuItems() {
  return (
    <>
      <div className="panel-section">
        <div className="section-label">Tài khoản</div>
        <Link href="/profile" className="menu-item">
          <div className="item-icon">
            <User size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Hồ sơ của tôi</span>
            <span className="item-sub">Sửa thông tin · đổi ảnh</span>
          </span>
        </Link>
        <Link href="/settings" className="menu-item">
          <div className="item-icon">
            <Settings size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Cài đặt</span>
            <span className="item-sub">Tuỳ chọn · bảo mật</span>
          </span>
        </Link>
      </div>

      <div className="panel-divider" />

      <div className="panel-section">
        <div className="section-label">Đăng ký</div>
        <Link href="/billing" className="menu-item">
          <div className="item-icon">
            <CreditCard size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Thanh toán</span>
            <span className="item-sub">Hoá đơn · phương thức</span>
          </span>
        </Link>
        <Link href="/upgrade" className="menu-item">
          <div className="item-icon">
            <Sparkles size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Nâng cấp</span>
          </span>
          <span className="item-tag tag-new">MỚI</span>
        </Link>
        <Link href="/refer" className="menu-item">
          <div className="item-icon">
            <Gift size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Giới thiệu bạn bè</span>
          </span>
          <span className="item-tag tag-beta">BETA</span>
        </Link>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
 * ADMIN MENU — Quản trị
 * ────────────────────────────────────────────── */
function AdminMenuItems() {
  return (
    <>
      <div className="panel-section">
        <div className="section-label">Quản trị</div>
        <Link href="/admin" className="menu-item">
          <div className="item-icon">
            <LayoutDashboard size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Admin Dashboard</span>
            <span className="item-sub">Tổng quan · số liệu</span>
          </span>
        </Link>
        <Link href="/admin/users" className="menu-item">
          <div className="item-icon">
            <Users size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Người dùng</span>
            <span className="item-sub">Danh sách · phân quyền</span>
          </span>
        </Link>
        <Link href="/admin/announcements" className="menu-item">
          <div className="item-icon">
            <Megaphone size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Thông báo</span>
            <span className="item-sub">Quản lý banner admin</span>
          </span>
        </Link>
      </div>

      <div className="panel-divider" />

      <div className="panel-section">
        <div className="section-label">Nội dung</div>
        <Link href="/admin/posts" className="menu-item">
          <div className="item-icon">
            <FileText size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Bài viết</span>
            <span className="item-sub">CMS · draft · publish</span>
          </span>
        </Link>
        <Link href="/admin/audit" className="menu-item">
          <div className="item-icon">
            <History size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Audit log</span>
            <span className="item-sub">Lịch sử hành động</span>
          </span>
        </Link>
        <Link href="/admin/roles" className="menu-item">
          <div className="item-icon">
            <UserCheck size={14} strokeWidth={2} />
          </div>
          <span className="item-text">
            <span className="item-label">Vai trò / Quyền</span>
          </span>
          <span className="item-tag tag-beta">BETA</span>
        </Link>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
 * ROLE SWITCHER — preview Guest/User/Admin mock
 * ────────────────────────────────────────────── */
function RoleSwitcher({
  role,
  setRole,
  compact = false,
}: {
  role: UserRole;
  setRole: (r: UserRole) => void;
  compact?: boolean;
}) {
  const opts: Array<{ v: UserRole; label: string; icon: React.ReactNode }> = [
    { v: 'guest', label: 'Guest', icon: <User size={11} strokeWidth={2.5} /> },
    {
      v: 'user',
      label: 'User',
      icon: <Sun size={11} strokeWidth={2.5} />,
    },
    {
      v: 'admin',
      label: 'Admin',
      icon: <Shield size={11} strokeWidth={2.5} />,
    },
  ];
  return (
    <div className={`role-switcher ${compact ? 'compact' : ''}`}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`role-btn ${role === o.v ? 'active' : ''} role-${o.v}`}
          onClick={() => setRole(o.v)}
          aria-pressed={role === o.v}
          title={`Xem như ${o.label}`}
        >
          {o.icon}
          {!compact && <span>{o.label}</span>}
        </button>
      ))}
      <style jsx>{`
        .role-switcher {
          display: inline-flex;
          padding: 3px;
          gap: 2px;
          background: var(--color-surface-muted);
          border-radius: 8px;
          border: 1px solid var(--color-border-subtle);
        }
        .role-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .role-btn:hover {
          color: var(--color-text-primary);
        }
        .role-btn.active.role-guest {
          background: var(--color-surface-bg_elevated);
          color: var(--color-text-primary);
        }
        .role-btn.active.role-user {
          background: var(--color-accent-soft);
          color: var(--color-accent-primary);
        }
        .role-btn.active.role-admin {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
        }
        .role-switcher.compact .role-btn {
          padding: 5px;
        }
      `}</style>
    </div>
  );
}

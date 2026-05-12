/**
 * Phase 40.16 — PaymentModal shared cho mọi module Finance.
 *
 * Hiển thị:
 *  - Tổng tiền
 *  - 2 tab: 💵 Tiền mặt / 📱 Chuyển khoản (QR VietQR)
 *  - QR code: dùng img.vietqr.io (server-side render → free, không cần npm)
 *  - Tiền khách đưa + tiền thừa (cho mode cash)
 *  - Nút xác nhận thanh toán
 *
 * Usage:
 *   <PaymentModal total={150000} description="Sân pickleball T7" customerName="Anh A"
 *     onConfirm={(method, paid) => ...} onClose={() => setOpen(false)} />
 */
import { useState, useEffect } from 'react';
import { CreditCard, Banknote, CheckCircle2, X, AlertCircle, Settings } from 'lucide-react';
import { hasShopBankInfo, loadShopSettings, makeVietQRUrl, saveShopSettings, VIETQR_BANKS } from '../lib/shop-settings';

export interface PaymentResult {
  method: 'cash' | 'transfer';
  paid: number;
}

interface Props {
  total: number;
  /** Mô tả hiện trên QR (tối đa 50 ký tự, alphanumeric) */
  description: string;
  customerName?: string;
  onConfirm: (result: PaymentResult) => void;
  onClose: () => void;
}

export function PaymentModal({ total, description, customerName, onConfirm, onClose }: Props): JSX.Element {
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [cashPaid, setCashPaid] = useState(total);
  const [showSettings, setShowSettings] = useState(false);
  const [bankInfo, setBankInfo] = useState(loadShopSettings());

  useEffect(() => {
    setBankInfo(loadShopSettings());
  }, [showSettings]);

  const change = cashPaid - total;
  const qrUrl = makeVietQRUrl(total, description);
  const hasBank = hasShopBankInfo();

  function formatMoney(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
  }

  function handleConfirm(): void {
    if (method === 'cash') {
      if (cashPaid < total) return;
      onConfirm({ method: 'cash', paid: cashPaid });
    } else {
      onConfirm({ method: 'transfer', paid: total });
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 480, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 0 }}
      >
        {/* Header với tổng tiền */}
        <div
          style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))',
            borderBottom: '1px solid var(--color-border-subtle)',
            borderRadius: '14px 14px 0 0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
                Thanh toán
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-accent-primary)', marginTop: 4, lineHeight: 1 }}>
                {formatMoney(total)}
              </div>
              {customerName && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  Khách: <strong>{customerName}</strong>
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} className="icon-btn">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Method tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <button
            type="button"
            onClick={() => setMethod('cash')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: method === 'cash' ? 'var(--color-surface-card)' : 'var(--color-surface-row)',
              color: method === 'cash' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: method === 'cash' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Banknote style={{ width: 16, height: 16 }} /> Tiền mặt
          </button>
          <button
            type="button"
            onClick={() => setMethod('transfer')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: method === 'transfer' ? 'var(--color-surface-card)' : 'var(--color-surface-row)',
              color: method === 'transfer' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: method === 'transfer' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <CreditCard style={{ width: 16, height: 16 }} /> Chuyển khoản
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {method === 'cash' ? (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Tiền khách đưa
              </label>
              <input
                type="number"
                className="input"
                value={cashPaid}
                onChange={(e) => setCashPaid(Math.max(0, Number(e.target.value) || 0))}
                min={0}
                step={10000}
                autoFocus
                style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[total, Math.ceil(total / 10000) * 10000 + 0, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000, Math.ceil(total / 500000) * 500000].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 5).map((v) => (
                  <button key={v} type="button" onClick={() => setCashPaid(v)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                    {formatMoney(v)}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: change >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${change >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {change >= 0 ? 'Tiền thừa trả khách' : 'Còn thiếu'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: change >= 0 ? '#10B981' : '#DC2626', marginTop: 4 }}>
                  {formatMoney(Math.abs(change))}
                </div>
              </div>
            </>
          ) : (
            <>
              {!hasBank ? (
                <div style={{ padding: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E', marginBottom: 8 }}>
                    <AlertCircle style={{ width: 16, height: 16 }} />
                    <strong>Chưa cấu hình tài khoản ngân hàng</strong>
                  </div>
                  <p style={{ fontSize: 12, color: '#92400E', margin: '0 0 10px' }}>
                    Cần điền số tài khoản + tên ngân hàng để khách quét QR chuyển tiền. Cấu hình 1 lần là xài mãi.
                  </p>
                  <button type="button" onClick={() => setShowSettings(true)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10, fontWeight: 700 }}>
                    <Settings style={{ width: 14, height: 14 }} /> Cấu hình ngay
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Khách quét QR bằng app ngân hàng để chuyển khoản
                  </div>
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="VietQR"
                      style={{
                        width: '100%',
                        maxWidth: 280,
                        height: 'auto',
                        margin: '0 auto',
                        display: 'block',
                        borderRadius: 12,
                        background: '#FFF',
                        padding: 8,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Đang tạo QR…</div>
                  )}
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--color-surface-row)', borderRadius: 10, fontSize: 12, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Ngân hàng:</span>
                      <strong>{VIETQR_BANKS.find((b) => b.code === bankInfo.bankCode)?.name ?? bankInfo.bankCode}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Số TK:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{bankInfo.bankAccount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Chủ TK:</span>
                      <strong>{bankInfo.bankAccountName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Nội dung:</span>
                      <strong style={{ fontSize: 11 }}>{description.slice(0, 50)}</strong>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowSettings(true)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                    <Settings style={{ width: 11, height: 11, display: 'inline', verticalAlign: -1 }} /> Sửa thông tin ngân hàng
                  </button>
                </div>
              )}
            </>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={method === 'cash' ? cashPaid < total : !hasBank}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: 14,
              fontSize: 15,
              fontWeight: 700,
              marginTop: 16,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16 }} />
            {method === 'cash' ? `Đã thu tiền mặt — ${formatMoney(cashPaid)}` : `Đã nhận chuyển khoản — ${formatMoney(total)}`}
          </button>
        </div>
      </div>

      {showSettings && <ShopSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ============================================================
// Shop settings modal — cấu hình bank info
// ============================================================
export function ShopSettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [settings, setSettings] = useState(loadShopSettings());

  function handleSave(): void {
    saveShopSettings(settings);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 18, height: 18 }} /> Thông tin cửa hàng
          </h2>
          <button type="button" onClick={onClose} className="icon-btn">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 16 }}>
          Thông tin này dùng cho mã QR chuyển khoản hiển thị khi thanh toán. Cấu hình 1 lần, dùng cho mọi module.
        </p>

        <FormField label="Tên cửa hàng">
          <input
            className="input"
            value={settings.shopName}
            onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
            placeholder="VD: Cafe Trí, Tạp hoá Anh Hai..."
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <FormField label="Ngân hàng">
            <select className="input" value={settings.bankCode} onChange={(e) => setSettings({ ...settings, bankCode: e.target.value })}>
              {VIETQR_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </FormField>
          <FormField label="Số tài khoản">
            <input
              className="input"
              value={settings.bankAccount}
              onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value.replace(/\s+/g, '') })}
              placeholder="0123456789"
              style={{ fontFamily: 'monospace' }}
            />
          </FormField>
        </div>

        <FormField label="Tên chủ tài khoản (IN HOA, KHÔNG DẤU)">
          <input
            className="input"
            value={settings.bankAccountName}
            onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value.toUpperCase() })}
            placeholder="HO SY TRI"
            style={{ textTransform: 'uppercase' }}
          />
        </FormField>

        <FormField label="SĐT (optional)">
          <input
            className="input"
            type="tel"
            value={settings.phone ?? ''}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            placeholder="09xx..."
          />
        </FormField>

        <FormField label="Địa chỉ (optional)">
          <input
            className="input"
            value={settings.address ?? ''}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            placeholder="VD: 123 Lê Lợi, Hải Châu, Đà Nẵng"
          />
        </FormField>

        <div style={{ padding: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 11, color: '#1E40AF', marginBottom: 12 }}>
          💡 Mã QR sẽ tự render từ <code>img.vietqr.io</code> (miễn phí, không cần đăng ký). Tương thích tất cả app ngân hàng VN.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!settings.bankCode || !settings.bankAccount || !settings.bankAccountName}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * SetupWizard — Phase 22.4
 *
 * 4 step:
 *   1. Welcome + tạo bot qua @BotFather
 *   2. Paste BOT_TOKEN → tg_test_bot verify
 *   3. Paste CHANNEL_ID → tg_get_chat verify bot là admin
 *   4. Tạo passphrase → derive AES master key + creds_save (keyring)
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Bot, ArrowRight, CheckCircle2, AlertCircle, ExternalLink, Lock } from 'lucide-react';
import logoUrl from '../assets/logo.png';

interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface ChatInfo {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export function SetupWizard({ uid, onDone }: { uid: string; onDone: () => void }): JSX.Element {
  const [step, setStep] = useState(1);
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [passphrase2, setPassphrase2] = useState('');
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function testBot() {
    setBusy(true);
    setErr(null);
    try {
      const info = await invoke<BotInfo>('tg_test_bot', { token: botToken.trim() });
      setBotInfo(info);
      setStep(3);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function testChat() {
    setBusy(true);
    setErr(null);
    try {
      const cid = parseInt(channelId.trim(), 10);
      if (Number.isNaN(cid)) {
        setErr('Channel ID phải là số (vd: -1001234567890)');
        setBusy(false);
        return;
      }
      const info = await invoke<ChatInfo>('tg_get_chat', { token: botToken.trim(), chatId: cid });
      setChatInfo(info);
      setStep(4);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (passphrase !== passphrase2) {
      setErr('2 lần nhập passphrase phải giống nhau');
      return;
    }
    if (passphrase.length < 8) {
      setErr('Passphrase phải dài tối thiểu 8 ký tự');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await invoke('creds_save', {
        uid,
        botToken: botToken.trim(),
        channelId: chatInfo!.id,
        channelTitle: chatInfo!.title || 'Untitled',
        passphrase,
      });
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-surface-bg)' }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoUrl} alt="TrishDrive" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', boxShadow: 'var(--shadow-sm)' }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)' }}>TrishDrive Setup</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Bước {step}/4 — Telegram cloud storage</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className="flex-1 h-1 rounded-full transition"
              style={{ background: n <= step ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)' }}
            />
          ))}
        </div>

        <div className="card">
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && <Step2 token={botToken} setToken={setBotToken} onTest={testBot} busy={busy} err={err} />}
          {step === 3 && botInfo && <Step3 botInfo={botInfo} channelId={channelId} setChannelId={setChannelId} onTest={testChat} busy={busy} err={err} />}
          {step === 4 && chatInfo && <Step4 chatInfo={chatInfo} passphrase={passphrase} setPassphrase={setPassphrase} passphrase2={passphrase2} setPassphrase2={setPassphrase2} onSave={saveAll} busy={busy} err={err} />}
        </div>
      </div>
    </div>
  );
}

function Step1({ onNext }: { onNext: () => void }): JSX.Element {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Tạo Telegram Bot</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        TrishDrive dùng 1 Telegram bot riêng để upload file vào private channel của Trí. Free, không quota.
      </p>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 16, lineHeight: 1.8, paddingLeft: 20 }}>
        <li>Mở Telegram → tìm <strong>@BotFather</strong></li>
        <li>Gõ <code>/newbot</code> → đặt tên bot (vd: TrishDrive Personal)</li>
        <li>Đặt username (phải end bằng <code>bot</code>, vd: <code>tridrive_bot</code>)</li>
        <li>BotFather trả về <strong>BOT TOKEN</strong> dạng <code>123456789:AAxxxxxxx</code> — copy lại</li>
        <li>Tạo private channel (Telegram → New Channel → Private)</li>
        <li>Add bot vừa tạo làm <strong>Admin</strong> của channel</li>
      </ol>
      <div className="flex gap-2 mt-6">
        <button className="btn-secondary" onClick={() => openUrl('https://t.me/BotFather')}>
          <ExternalLink className="h-4 w-4" /> Mở @BotFather
        </button>
        <button className="btn-primary" onClick={onNext}>
          Đã hiểu, tiếp tục <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Step2({ token, setToken, onTest, busy, err }: { token: string; setToken: (v: string) => void; onTest: () => void; busy: boolean; err: string | null }): JSX.Element {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Bot Token</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        Paste token từ @BotFather. Token sẽ được mã hoá lưu Windows Credential Manager.
      </p>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>BOT TOKEN</label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="123456789:AABBccdd..."
          className="input-field"
          style={{ marginTop: 4, fontFamily: 'monospace' }}
        />
      </div>
      {err && <ErrBox err={err} />}
      <div className="flex gap-2 mt-6">
        <button className="btn-primary" onClick={onTest} disabled={!token || busy}>
          <Bot className="h-4 w-4" /> {busy ? 'Đang kiểm tra...' : 'Verify token'}
        </button>
      </div>
    </div>
  );
}

function Step3({ botInfo, channelId, setChannelId, onTest, busy, err }: { botInfo: BotInfo; channelId: string; setChannelId: (v: string) => void; onTest: () => void; busy: boolean; err: string | null }): JSX.Element {
  return (
    <div>
      <div className="flex gap-2 items-center mb-3" style={{ color: 'var(--color-accent-primary)' }}>
        <CheckCircle2 className="h-5 w-5" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Bot OK: <strong>@{botInfo.username}</strong> ({botInfo.first_name})</span>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Channel ID</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        Lấy channel ID: forward 1 tin nhắn từ channel cho <strong>@username_to_id_bot</strong> hoặc <strong>@RawDataBot</strong> để lấy ID dạng <code>-100xxxxxxxxxx</code>.
      </p>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>CHANNEL ID (số âm bắt đầu -100)</label>
        <input
          type="text"
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
          placeholder="-1001234567890"
          className="input-field"
          style={{ marginTop: 4, fontFamily: 'monospace' }}
        />
      </div>
      {err && <ErrBox err={err} />}
      <div className="flex gap-2 mt-6">
        <button className="btn-secondary" onClick={() => openUrl('https://t.me/RawDataBot')}>
          <ExternalLink className="h-4 w-4" /> Mở @RawDataBot
        </button>
        <button className="btn-primary" onClick={onTest} disabled={!channelId || busy}>
          {busy ? 'Đang kiểm tra...' : 'Verify channel'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Step4({ chatInfo, passphrase, setPassphrase, passphrase2, setPassphrase2, onSave, busy, err }: { chatInfo: ChatInfo; passphrase: string; setPassphrase: (v: string) => void; passphrase2: string; setPassphrase2: (v: string) => void; onSave: () => void; busy: boolean; err: string | null }): JSX.Element {
  return (
    <div>
      <div className="flex gap-2 items-center mb-3" style={{ color: 'var(--color-accent-primary)' }}>
        <CheckCircle2 className="h-5 w-5" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Channel OK: <strong>{chatInfo.title}</strong> ({chatInfo.type})</span>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Encryption Passphrase</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        File sẽ được mã hoá AES-256-GCM trước khi upload Telegram (chỉ Trí decrypt được).
        <strong style={{ color: 'var(--color-text-primary)' }}> KHÔNG quên passphrase này — không có cách recovery.</strong>
      </p>
      <div className="form-grid mt-4">
        <label>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Passphrase (≥ 8 ký tự)</div>
          <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} className="input-field" style={{ marginTop: 4 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Nhập lại</div>
          <input type="password" value={passphrase2} onChange={e => setPassphrase2(e.target.value)} className="input-field" style={{ marginTop: 4 }} />
        </label>
      </div>
      {err && <ErrBox err={err} />}
      <div className="flex gap-2 mt-6">
        <button className="btn-primary" onClick={onSave} disabled={busy}>
          <Lock className="h-4 w-4" /> {busy ? 'Đang lưu...' : 'Lưu cấu hình + bắt đầu'}
        </button>
      </div>
    </div>
  );
}

function ErrBox({ err }: { err: string }): JSX.Element {
  return (
    <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
      <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
    </div>
  );
}

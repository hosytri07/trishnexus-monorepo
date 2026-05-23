/**
 * Phase 18.2.f — Note stats + word frequency modal.
 *
 * Đọc note store từ localStorage (mirror đã có cho Ctrl+K), tính:
 *   - Tổng số notes (active vs trash)
 *   - Tổng words / chars
 *   - Top 30 từ xuất hiện nhiều nhất (lọc stopwords)
 *   - Active days (ngày có updates)
 *   - Note dài nhất / ngắn nhất
 */

import { useEffect, useMemo, useState } from 'react';

interface NoteLike {
  title?: string;
  content_html?: string;
  trashed?: boolean;
  category?: string;
  updated_at?: number;
  created_at?: number;
  pinned?: boolean;
}

interface Props {
  onClose: () => void;
}

const VI_EN_STOPWORDS = new Set<string>([
  // Vietnamese common
  'và', 'là', 'của', 'có', 'không', 'được', 'cho', 'với', 'này', 'đó',
  'một', 'các', 'những', 'để', 'thì', 'đã', 'đang', 'sẽ', 'cũng', 'rất',
  'tôi', 'bạn', 'mình', 'chúng', 'họ', 'ta', 'người', 'khi', 'như',
  'mà', 'nhưng', 'vì', 'do', 'nếu', 'thế', 'nên', 'còn', 'từ', 'về',
  'theo', 'trong', 'ngoài', 'trên', 'dưới', 'sau', 'trước', 'lại',
  'hay', 'hoặc', 'làm', 'đến', 'tại', 'bị', 'đi', 'ra', 'vào', 'lên',
  'xuống', 'qua', 'thì', 'rồi', 'đây', 'kia', 'đấy', 'nhé',
  // English common
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'its', 'our', 'their', 'mine', 'yours', 'in', 'on', 'at',
  'to', 'for', 'with', 'by', 'from', 'of', 'as', 'so', 'if', 'then',
  'than', 'when', 'where', 'why', 'how', 'what', 'who', 'whom',
  'all', 'any', 'some', 'no', 'not', 'each', 'every', 'about', 'one',
  'two', 'three', 'first', 'last', 'few', 'more', 'most', 'other',
  'such', 'only', 'just', 'also', 'even', 'still', 'too', 'very',
  // Time-ish
  'ngày', 'tháng', 'năm', 'giờ', 'phút', 'tuần',
]);

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
}

function tokenize(text: string): string[] {
  // Split on whitespace + punctuation, keep alphanumeric + Vietnamese diacritics
  return text
    .toLowerCase()
    .split(/[\s.,;:!?'"()\[\]{}<>/\\|@#$%^&*+=`~\-_…—–]+/u)
    .filter((w) => w.length >= 2 && w.length <= 24)
    .filter((w) => !VI_EN_STOPWORDS.has(w))
    .filter((w) => !/^\d+$/.test(w)); // skip pure numbers
}

function loadNotes(): NoteLike[] {
  try {
    const candidates = [
      'trishlibrary.note.store.v1',
      'trishlibrary.note.store',
      'trishnote.store.v1',
    ];
    let raw: string | null = null;
    for (const k of candidates) {
      raw = window.localStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.notes) ? parsed.notes : [];
  } catch {
    return [];
  }
}

export function NoteStatsModal({ onClose }: Props): JSX.Element {
  const [notes, setNotes] = useState<NoteLike[]>(() => loadNotes());

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Refresh on focus (in case user switched modules + edited)
  useEffect(() => {
    function onFocus(): void {
      setNotes(loadNotes());
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const stats = useMemo(() => {
    const active = notes.filter((n) => !n.trashed);
    const trashed = notes.filter((n) => n.trashed);
    const project = active.filter((n) => n.category === 'project');
    const personal = active.filter((n) => n.category !== 'project');
    const pinned = active.filter((n) => n.pinned);

    let totalWords = 0;
    let totalChars = 0;
    const wordFreq = new Map<string, number>();
    const dayMap = new Map<string, number>();
    let longest = { title: '', words: 0 };

    for (const n of active) {
      const text = stripHtml(n.content_html ?? '');
      const titleText = (n.title ?? '').trim();
      const allText = `${titleText} ${text}`;
      const tokens = tokenize(allText);
      totalWords += tokens.length;
      totalChars += text.length;

      for (const w of tokens) {
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }

      if (tokens.length > longest.words) {
        longest = { title: titleText || '(Chưa đặt)', words: tokens.length };
      }

      if (n.updated_at) {
        const day = new Date(n.updated_at).toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      }
    }

    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    const maxFreq = topWords[0]?.[1] ?? 1;

    const activeDays = Array.from(dayMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);

    return {
      totalActive: active.length,
      trashed: trashed.length,
      project: project.length,
      personal: personal.length,
      pinned: pinned.length,
      totalWords,
      totalChars,
      topWords,
      maxFreq,
      activeDays,
      uniqueWords: wordFreq.size,
      longest,
    };
  }, [notes]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="note-stats-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Note stats"
      >
        <header className="note-stats-head">
          <h2>📊 Thống kê Ghi chú</h2>
          <button className="mini" onClick={onClose} title="Đóng (Esc)">
            ×
          </button>
        </header>

        <div className="note-stats-body">
          {notes.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: 36 }}>
              Chưa có note nào. Tạo note để xem stats.
            </div>
          ) : (
            <>
              {/* Top stat cards */}
              <div className="note-stats-grid">
                <StatCard icon="📝" value={stats.totalActive} label="Notes active" />
                <StatCard icon="📌" value={stats.pinned} label="Đã ghim" />
                <StatCard icon="📂" value={stats.project} label="Dự án" color="#4dabf7" />
                <StatCard icon="🌱" value={stats.personal} label="Cá nhân" color="#2bb673" />
                <StatCard icon="🗑" value={stats.trashed} label="Trash" color="#999" />
                <StatCard
                  icon="📚"
                  value={stats.totalWords.toLocaleString()}
                  label="Tổng từ"
                />
                <StatCard
                  icon="🔤"
                  value={stats.uniqueWords.toLocaleString()}
                  label="Từ độc lập"
                />
                <StatCard
                  icon="📏"
                  value={(stats.totalChars / 1024).toFixed(1) + ' K'}
                  label="Tổng ký tự"
                />
              </div>

              {/* Longest note */}
              {stats.longest.words > 0 && (
                <div className="note-stats-section">
                  <h3>📖 Note dài nhất</h3>
                  <p>
                    <strong>{stats.longest.title}</strong> — {stats.longest.words} từ
                  </p>
                </div>
              )}

              {/* Active days */}
              {stats.activeDays.length > 0 && (
                <div className="note-stats-section">
                  <h3>🗓 7 ngày hoạt động nhiều nhất</h3>
                  <ul className="note-stats-days">
                    {stats.activeDays.map(([day, count]) => (
                      <li key={day}>
                        <span className="muted small">{day}</span>
                        <div
                          className="note-stats-bar"
                          style={{
                            width: `${(count / stats.activeDays[0][1]) * 100}%`,
                          }}
                        />
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Word frequency */}
              {stats.topWords.length > 0 && (
                <div className="note-stats-section">
                  <h3>🏆 Top 30 từ xuất hiện nhiều nhất</h3>
                  <p className="muted small">
                    Đã lọc stopwords (và, là, của, the, a...) và số thuần.
                  </p>
                  <ul className="note-stats-words">
                    {stats.topWords.map(([word, count]) => (
                      <li key={word}>
                        <strong className="note-stats-word">{word}</strong>
                        <div
                          className="note-stats-bar note-stats-bar-word"
                          style={{ width: `${(count / stats.maxFreq) * 100}%` }}
                        />
                        <span className="muted small">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
}): JSX.Element {
  return (
    <div className="note-stat-card">
      <span className="note-stat-icon">{icon}</span>
      <div>
        <strong style={color ? { color } : undefined}>{value}</strong>
        <span className="muted small">{label}</span>
      </div>
    </div>
  );
}

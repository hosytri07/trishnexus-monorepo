'use client';

/**
 * /on-thi-chung-chi — Phase 19.21 (refactor).
 *
 * Sử dụng ngân hàng câu hỏi BXD 163/QĐ-BXD ngày 18/02/2025 — 8,081 câu,
 * 16 chuyên ngành, 3 hạng I/II/III, 3 chuyên đề CM/PLC/PLR.
 *
 * State machine:
 *   - 'loading'  : đang tải JSON ngân hàng câu hỏi
 *   - 'picker'   : 3 step (specialty → class → categories) → bắt đầu thi
 *   - 'quiz'     : đang làm bài
 *   - 'result'   : kết quả + review
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  FileBadge,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  loadBxd163,
  groupTopicsByChapter,
  buildExam,
  evaluateExam,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  CLASS_LABEL,
  CLASS_DESC,
  DEFAULT_EXAM_CONFIG,
  type BxdDataset,
  type BxdTopic,
  type BxdQuestion,
  type BxdExamResult,
  type CertClass,
  type CertCategory,
  type ChapterGroup,
} from '@/lib/cert-bxd163';

type View = 'loading' | 'picker' | 'quiz' | 'result';

interface ExamState {
  topicSlug: string;
  topicCode: string;
  topicName: string;
  cls: CertClass;
  cats: CertCategory[];
  questions: BxdQuestion[];
  answers: (number | null)[];
  startedAt: number;
  currentIdx: number;
}

const STORAGE_KEY = 'trishteam:cert-bxd163-exam';

export default function CertExamBxdPage() {
  const [view, setView] = useState<View>('loading');
  const [dataset, setDataset] = useState<BxdDataset | null>(null);
  const [exam, setExam] = useState<ExamState | null>(null);
  const [result, setResult] = useState<BxdExamResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load dataset on mount + restore exam state from localstorage
  useEffect(() => {
    let cancelled = false;
    loadBxd163()
      .then((data) => {
        if (cancelled) return;
        setDataset(data);
        // Try restore exam
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as ExamState;
            if (parsed.questions && parsed.answers && parsed.questions.length > 0) {
              setExam(parsed);
              setView('quiz');
              return;
            }
          }
        } catch {
          /* ignore */
        }
        setView('picker');
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(String(e));
        setView('picker');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!exam) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exam));
    } catch {
      /* ignore */
    }
  }, [exam]);

  function start(topic: BxdTopic, cls: CertClass, cats: CertCategory[]) {
    const questions = buildExam(topic, cls, DEFAULT_EXAM_CONFIG, cats);
    if (questions.length === 0) {
      alert('Không có câu hỏi cho cấu hình này. Vui lòng chọn lại.');
      return;
    }
    setExam({
      topicSlug: topic.code,
      topicCode: topic.code,
      topicName: topic.name,
      cls,
      cats,
      questions,
      answers: new Array(questions.length).fill(null),
      startedAt: Date.now(),
      currentIdx: 0,
    });
    setResult(null);
    setView('quiz');
  }

  function answer(optIdx: number) {
    if (!exam) return;
    const arr = [...exam.answers];
    arr[exam.currentIdx] = optIdx;
    setExam({ ...exam, answers: arr });
  }

  function jump(delta: number) {
    if (!exam) return;
    const next = exam.currentIdx + delta;
    if (next >= 0 && next < exam.questions.length) setExam({ ...exam, currentIdx: next });
  }

  function jumpTo(idx: number) {
    if (!exam) return;
    if (idx >= 0 && idx < exam.questions.length) setExam({ ...exam, currentIdx: idx });
  }

  function submit() {
    if (!exam) return;
    setResult(evaluateExam(exam.questions, exam.answers));
    setView('result');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function reset() {
    setExam(null);
    setResult(null);
    setView('picker');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  if (view === 'loading')
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <Loader2 size={36} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent-primary)' }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Đang tải ngân hàng câu hỏi BXD 163/2025...</p>
      </main>
    );

  if (view === 'picker' || !dataset)
    return <PickerView dataset={dataset} onStart={start} loadError={loadError} />;
  if (view === 'quiz' && exam)
    return (
      <QuizView
        exam={exam}
        onAnswer={answer}
        onPrev={() => jump(-1)}
        onNext={() => jump(1)}
        onJumpTo={jumpTo}
        onSubmit={submit}
        onReset={reset}
      />
    );
  if (view === 'result' && exam && result) return <ResultView exam={exam} result={result} onReset={reset} />;
  return <PickerView dataset={dataset} onStart={start} loadError={loadError} />;
}

// ============================================================
// Picker — 3 step
// ============================================================
function PickerView({
  dataset,
  onStart,
  loadError,
}: {
  dataset: BxdDataset | null;
  onStart: (topic: BxdTopic, cls: CertClass, cats: CertCategory[]) => void;
  loadError: string | null;
}) {
  const [step, setStep] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<BxdTopic | null>(null);
  const [selectedCls, setSelectedCls] = useState<CertClass>('III');
  const [selectedCats, setSelectedCats] = useState<CertCategory[]>(['cm', 'plc', 'plr']);

  const groups = useMemo<ChapterGroup[]>(
    () => (dataset ? groupTopicsByChapter(dataset) : []),
    [dataset],
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <FileBadge size={28} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Ôn thi Chứng chỉ Hành nghề Xây dựng
          </h1>
        </div>
        <p className="text-base md:text-lg max-w-3xl mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Bộ đề chính thức theo <strong>QĐ 163/QĐ-BXD ngày 18/02/2025</strong> — 8,081 câu, 16 chuyên ngành, 3 hạng (I/II/III).
        </p>
        {loadError && (
          <p className="text-sm" style={{ color: '#EF4444' }}>
            ⚠ Không tải được ngân hàng câu hỏi: {loadError}
          </p>
        )}
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
              style={{
                background: s <= step ? 'var(--color-accent-primary)' : 'var(--color-surface-muted)',
                color: s <= step ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {s}
            </div>
            <span
              className="text-xs font-medium"
              style={{
                color: s === step ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {s === 1 ? 'Chuyên ngành' : s === 2 ? 'Hạng' : 'Chuyên đề'}
            </span>
            {idx < 2 && (
              <div className="w-6 h-0.5" style={{ background: 'var(--color-border-default)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Chọn chuyên ngành */}
      {step === 1 && (
        <section>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            1️⃣ Chọn chuyên ngành
          </h2>
          {groups.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Đang tải dữ liệu...
            </p>
          )}
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.chapter}>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"
                  style={{ color: g.color }}
                >
                  <span className="text-base">{g.icon}</span>
                  {g.name} ({g.topics.length} chuyên ngành)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {g.topics.map((t) => {
                    const isSelected = selectedTopic?.code === t.code;
                    return (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(t);
                          setStep(2);
                        }}
                        className="text-left flex items-start gap-3 p-3 rounded-lg border transition-all hover:scale-[1.005]"
                        style={{
                          background: isSelected ? 'var(--color-accent-soft)' : 'var(--color-surface-card)',
                          borderColor: isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-default)',
                          borderLeftWidth: 3,
                          borderLeftColor: g.color,
                        }}
                      >
                        <span
                          className="font-mono text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                          style={{ background: g.color + '22', color: g.color }}
                        >
                          {t.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {t.name}
                          </h4>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.questions.length} câu hỏi · 3 hạng · 3 chuyên đề
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Chọn hạng */}
      {step === 2 && selectedTopic && (
        <section>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs mb-3 inline-flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={11} /> Đổi chuyên ngành
          </button>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            2️⃣ Chọn hạng cho{' '}
            <span style={{ color: 'var(--color-accent-primary)' }}>{selectedTopic.name}</span>
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Hạng quyết định cấp công trình bạn được phép chủ trì.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['I', 'II', 'III'] as CertClass[]).map((cls) => {
              const count = selectedTopic.questions.filter((q) => q.cls === cls).length;
              const isSel = selectedCls === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    setSelectedCls(cls);
                    setStep(3);
                  }}
                  className="text-left p-4 rounded-lg border transition-all hover:scale-[1.01]"
                  style={{
                    background: isSel ? 'var(--color-accent-soft)' : 'var(--color-surface-card)',
                    borderColor: isSel ? 'var(--color-accent-primary)' : 'var(--color-border-default)',
                  }}
                >
                  <div className="text-2xl font-extrabold mb-1" style={{ color: 'var(--color-accent-primary)' }}>
                    {CLASS_LABEL[cls]}
                  </div>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {CLASS_DESC[cls]}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {count} câu hỏi
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 3: Chọn chuyên đề */}
      {step === 3 && selectedTopic && (
        <section>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-xs mb-3 inline-flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={11} /> Đổi hạng
          </button>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            3️⃣ Chuyên đề
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Mặc định trộn cả 3 chuyên đề (giống đề thi thật). Bạn có thể bỏ chọn để luyện riêng.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {(['cm', 'plc', 'plr'] as CertCategory[]).map((c) => {
              const count = selectedTopic.questions.filter((q) => q.cls === selectedCls && q.cat === c).length;
              const checked = selectedCats.includes(c);
              return (
                <label
                  key={c}
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                  style={{
                    background: checked ? CATEGORY_COLOR[c] + '14' : 'var(--color-surface-card)',
                    borderColor: checked ? CATEGORY_COLOR[c] : 'var(--color-border-default)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCats([...selectedCats, c]);
                      else setSelectedCats(selectedCats.filter((x) => x !== c));
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: CATEGORY_COLOR[c] }}>
                      {CATEGORY_LABEL[c]}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {count} câu hỏi
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <div
            className="rounded-md p-3 mb-5 text-xs"
            style={{ background: 'var(--color-surface-bg_elevated)', color: 'var(--color-text-secondary)' }}
          >
            📋 Cấu hình đề: <strong>{DEFAULT_EXAM_CONFIG.questionCount} câu</strong>, đậu ≥{' '}
            <strong>{DEFAULT_EXAM_CONFIG.passingScore}/{DEFAULT_EXAM_CONFIG.questionCount}</strong>, thời gian{' '}
            <strong>{DEFAULT_EXAM_CONFIG.durationMin} phút</strong>.
          </div>

          <button
            type="button"
            disabled={selectedCats.length === 0}
            onClick={() => onStart(selectedTopic, selectedCls, selectedCats)}
            className="inline-flex items-center gap-2 px-6 h-12 rounded-md text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
          >
            <Award size={16} /> Bắt đầu thi
          </button>
        </section>
      )}
    </main>
  );
}

// ============================================================
// Quiz
// ============================================================
interface QuizProps {
  exam: ExamState;
  onAnswer: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpTo: (idx: number) => void;
  onSubmit: () => void;
  onReset: () => void;
}

function QuizView({ exam, onAnswer, onPrev, onNext, onJumpTo, onSubmit, onReset }: QuizProps) {
  const q = exam.questions[exam.currentIdx]!;
  const selected = exam.answers[exam.currentIdx];
  const answeredCount = exam.answers.filter((a) => a !== null).length;
  const elapsedMin = Math.floor((Date.now() - exam.startedAt) / 60000);
  const cfg = DEFAULT_EXAM_CONFIG;

  return (
    <main className="max-w-5xl mx-auto px-6 py-6">
      <div
        className="flex items-center justify-between flex-wrap gap-3 mb-5 px-4 py-3 rounded-lg border"
        style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {exam.topicName}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {CLASS_LABEL[exam.cls]} · Câu {exam.currentIdx + 1}/{exam.questions.length} · Đã trả lời {answeredCount}/{exam.questions.length}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <Clock size={14} /> {elapsedMin} / {cfg.durationMin} phút
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Bỏ đề thi? Tiến độ sẽ mất.')) onReset();
          }}
          className="text-xs px-2 h-7 rounded inline-flex items-center gap-1"
          style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
        >
          <RotateCcw size={11} /> Bỏ đề
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {exam.questions.map((_, i) => {
          const ans = exam.answers[i];
          const isCurrent = i === exam.currentIdx;
          const isAnswered = ans !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJumpTo(i)}
              className="inline-flex items-center justify-center text-[10px] font-bold w-7 h-7 rounded transition-colors"
              style={{
                background: isCurrent
                  ? 'var(--color-accent-primary)'
                  : isAnswered
                    ? 'var(--color-surface-muted)'
                    : 'transparent',
                color: isCurrent ? '#ffffff' : isAnswered ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: isCurrent ? 'none' : `1px solid var(--color-border-${isAnswered ? 'default' : 'subtle'})`,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <section
        className="rounded-xl border p-6 md:p-7 mb-5"
        style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
      >
        <div
          className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider mb-3"
          style={{ background: CATEGORY_COLOR[q.cat] + '22', color: CATEGORY_COLOR[q.cat] }}
        >
          {CATEGORY_LABEL[q.cat]}
        </div>
        <h2
          className="text-base md:text-lg font-semibold mb-5 leading-relaxed"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {q.q}
        </h2>
        <div className="space-y-2">
          {q.o.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onAnswer(i)}
                className="w-full text-left flex items-start gap-3 p-3.5 rounded-lg transition-colors"
                style={{
                  background: isSelected ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
                  border: `1.5px solid ${isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
                  color: 'var(--color-text-primary)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
                  style={{
                    background: isSelected ? 'var(--color-accent-primary)' : 'var(--color-surface-muted)',
                    color: isSelected ? '#ffffff' : 'var(--color-text-muted)',
                  }}
                >
                  {String.fromCharCode(97 + i)}
                </span>
                <span className="text-sm md:text-base">{opt}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={exam.currentIdx === 0}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-md text-sm font-semibold disabled:opacity-40"
          style={{
            background: 'var(--color-surface-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <ArrowLeft size={14} /> Câu trước
        </button>
        {exam.currentIdx === exam.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              if (answeredCount < exam.questions.length) {
                if (!window.confirm(`Bạn còn ${exam.questions.length - answeredCount} câu chưa trả lời. Vẫn nộp bài?`))
                  return;
              }
              onSubmit();
            }}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-bold"
            style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
          >
            <Award size={14} /> Nộp bài
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-md text-sm font-semibold"
            style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
          >
            Câu sau <ArrowRight size={14} />
          </button>
        )}
      </div>
    </main>
  );
}

// ============================================================
// Result
// ============================================================
function ResultView({
  exam,
  result,
  onReset,
}: {
  exam: ExamState;
  result: BxdExamResult;
  onReset: () => void;
}) {
  const wrongs = useMemo(() => result.details.filter((d) => !d.isCorrect), [result]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <section
        className="rounded-2xl border p-8 mb-6 text-center"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: result.passed ? '#10B981' : '#EF4444',
          borderWidth: 2,
        }}
      >
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
          style={{
            background: result.passed ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
            color: result.passed ? '#10B981' : '#EF4444',
          }}
        >
          {result.passed ? <Trophy size={32} /> : <XCircle size={32} />}
        </div>
        <h1
          className="text-3xl md:text-4xl font-extrabold mb-2"
          style={{ color: result.passed ? '#10B981' : '#EF4444' }}
        >
          {result.passed ? 'ĐẬU 🎉' : 'CHƯA ĐẬU'}
        </h1>
        <p className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {result.correctCount} / {result.total}
        </p>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {exam.topicName} — {CLASS_LABEL[exam.cls]} — yêu cầu đậu ≥ {result.passingScore}/{result.total}
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-bold"
            style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
          >
            <RotateCcw size={14} /> Thi lại
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Đáp án chi tiết ({wrongs.length} câu sai)
        </h2>
        <div className="space-y-3">
          {result.details.map((d, i) => (
            <ReviewCard key={d.question.id} index={i} detail={d} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ReviewCard({ index, detail }: { index: number; detail: BxdExamResult['details'][number] }) {
  const { question, selectedIndex, isCorrect } = detail;
  return (
    <article
      className="rounded-lg border p-4"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: isCorrect ? 'var(--color-border-subtle)' : 'rgba(239,68,68,0.4)',
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
          style={{
            background: isCorrect ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
            color: isCorrect ? '#10B981' : '#EF4444',
          }}
        >
          {isCorrect ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs mb-1 inline-flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
            Câu {index + 1}
            <span
              className="inline-flex items-center px-1.5 h-4 rounded text-[10px] font-bold uppercase"
              style={{
                background: CATEGORY_COLOR[question.cat] + '22',
                color: CATEGORY_COLOR[question.cat],
              }}
            >
              {CATEGORY_LABEL[question.cat]}
            </span>
          </p>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {question.q}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 ml-8">
        {question.o.map((opt, i) => {
          const isSelected = selectedIndex === i;
          const isCorrectOpt = i === question.a;
          let bg = 'var(--color-surface-bg_elevated)';
          let bd = 'var(--color-border-subtle)';
          let label = '';
          if (isCorrectOpt) {
            bg = 'rgba(16,185,129,0.10)';
            bd = 'rgba(16,185,129,0.4)';
            label = '✓ Đáp án đúng';
          } else if (isSelected) {
            bg = 'rgba(239,68,68,0.10)';
            bd = 'rgba(239,68,68,0.4)';
            label = '✗ Bạn chọn';
          }
          return (
            <div key={i} className="flex items-start gap-2 p-2 rounded text-xs" style={{ background: bg, border: `1px solid ${bd}` }}>
              <span className="font-bold shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                {String.fromCharCode(97 + i)}.
              </span>
              <span style={{ color: 'var(--color-text-primary)' }} className="flex-1">
                {opt}
              </span>
              {label && (
                <span
                  className="text-[10px] font-bold whitespace-nowrap"
                  style={{ color: isCorrectOpt ? '#10B981' : '#EF4444' }}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

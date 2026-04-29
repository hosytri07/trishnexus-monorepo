'use client';

/**
 * /on-thi-lai-xe — Phase 19.5 (Đợt 4B) — MVP quiz app.
 *
 * Single-page state machine:
 *   - 'picker'  : chọn hạng A1/B1/B2/C
 *   - 'quiz'    : đang làm bài (timer + tiến độ)
 *   - 'result'  : kết quả + review từng câu
 *
 * State persist localStorage để resume nếu chuyển trang.
 *
 * Bộ câu hỏi: data/driving-questions.ts (sample 30 câu, sau sẽ thay full 600 câu).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Car,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  type DrivingMode,
  type DrivingQuestion,
  type ExamResult,
  MODE_CONFIGS,
  buildExam,
  evaluateExam,
} from '@/data/driving-questions';

type View = 'picker' | 'quiz' | 'result';

interface ExamState {
  mode: DrivingMode;
  questions: DrivingQuestion[];
  answers: (number | null)[];
  startedAt: number;
  currentIdx: number;
}

const STORAGE_KEY = 'trishteam:driving-exam';

export default function DrivingExamPage() {
  const [view, setView] = useState<View>('picker');
  const [exam, setExam] = useState<ExamState | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);

  // Restore exam if any (resume flow)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ExamState;
      // basic validation
      if (parsed.mode && Array.isArray(parsed.questions)) {
        setExam(parsed);
        setView('quiz');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-save exam state when changed
  useEffect(() => {
    if (!exam) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exam));
    } catch {
      /* ignore */
    }
  }, [exam]);

  function startExam(mode: DrivingMode) {
    const questions = buildExam(mode);
    if (questions.length === 0) {
      alert('Chưa có câu hỏi nào cho hạng này. Vui lòng thử hạng khác.');
      return;
    }
    const newExam: ExamState = {
      mode,
      questions,
      answers: new Array(questions.length).fill(null),
      startedAt: Date.now(),
      currentIdx: 0,
    };
    setExam(newExam);
    setResult(null);
    setView('quiz');
  }

  function answerCurrent(optionIdx: number) {
    if (!exam) return;
    const newAnswers = [...exam.answers];
    newAnswers[exam.currentIdx] = optionIdx;
    setExam({ ...exam, answers: newAnswers });
  }

  function nextQuestion() {
    if (!exam) return;
    if (exam.currentIdx < exam.questions.length - 1) {
      setExam({ ...exam, currentIdx: exam.currentIdx + 1 });
    }
  }

  function prevQuestion() {
    if (!exam) return;
    if (exam.currentIdx > 0) {
      setExam({ ...exam, currentIdx: exam.currentIdx - 1 });
    }
  }

  function jumpToQuestion(idx: number) {
    if (!exam) return;
    if (idx >= 0 && idx < exam.questions.length) {
      setExam({ ...exam, currentIdx: idx });
    }
  }

  function submitExam() {
    if (!exam) return;
    const r = evaluateExam(exam.mode, exam.questions, exam.answers);
    setResult(r);
    setView('result');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function resetExam() {
    setExam(null);
    setResult(null);
    setView('picker');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  if (view === 'picker') return <PickerView onStart={startExam} />;
  if (view === 'quiz' && exam)
    return (
      <QuizView
        exam={exam}
        onAnswer={answerCurrent}
        onNext={nextQuestion}
        onPrev={prevQuestion}
        onJump={jumpToQuestion}
        onSubmit={submitExam}
        onReset={resetExam}
      />
    );
  if (view === 'result' && exam && result)
    return <ResultView mode={exam.mode} result={result} onReset={resetExam} />;
  return <PickerView onStart={startExam} />;
}

// ============================================================
// View: Picker
// ============================================================
function PickerView({ onStart }: { onStart: (m: DrivingMode) => void }) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Car size={28} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Ôn thi bằng lái xe
          </h1>
        </div>
        <p
          className="text-base md:text-lg max-w-2xl"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Chọn hạng bằng để bắt đầu đề ôn thi. Mỗi đề ngẫu nhiên từ ngân hàng câu hỏi
          theo định mức Cục đăng kiểm. Sai 1 câu liệt là <strong>rớt cả đề</strong>.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(MODE_CONFIGS) as DrivingMode[]).map((mode) => {
          const cfg = MODE_CONFIGS[mode];
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode)}
              className="group flex flex-col items-start text-left p-5 rounded-xl border transition-all hover:scale-[1.01]"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-border-default)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-lg font-extrabold text-xl"
                  style={{
                    background: cfg.color + '22',
                    color: cfg.color,
                    border: `1.5px solid ${cfg.color}55`,
                  }}
                >
                  {cfg.mode}
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {cfg.name}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {cfg.shortDesc}
                  </p>
                </div>
              </div>
              <div
                className="grid grid-cols-3 gap-2 w-full text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Stat label="Số câu" value={`${cfg.questionCount}`} />
                <Stat label="Đậu ≥" value={`${cfg.passingScore}/${cfg.questionCount}`} />
                <Stat label="Thời gian" value={`${cfg.durationMin}'`} />
              </div>
              <div
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: cfg.color }}
              >
                Bắt đầu thi
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>

      <p
        className="mt-8 text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ⚠ Đề thi này dùng để <strong>ôn tập</strong>, không thay thế kỳ thi chính
        thức của Cục đăng kiểm. Hiện ngân hàng đang có{' '}
        <strong>30 câu mẫu</strong>; bộ đầy đủ 600 câu sẽ được nhập sau.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-2 py-1.5 text-center"
      style={{ background: 'var(--color-surface-bg_elevated)' }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ opacity: 0.7 }}>
        {label}
      </div>
      <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

// ============================================================
// View: Quiz
// ============================================================
interface QuizProps {
  exam: ExamState;
  onAnswer: (idx: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onJump: (idx: number) => void;
  onSubmit: () => void;
  onReset: () => void;
}

function QuizView({ exam, onAnswer, onNext, onPrev, onJump, onSubmit, onReset }: QuizProps) {
  const cfg = MODE_CONFIGS[exam.mode];
  const q = exam.questions[exam.currentIdx]!;
  const selected = exam.answers[exam.currentIdx];
  const answeredCount = exam.answers.filter((a) => a !== null).length;
  const elapsedMin = Math.floor((Date.now() - exam.startedAt) / 60000);

  return (
    <main className="max-w-5xl mx-auto px-6 py-6">
      {/* Top bar */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 mb-5 px-4 py-3 rounded-lg border"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-9 h-9 rounded-md font-extrabold text-sm"
            style={{
              background: cfg.color + '22',
              color: cfg.color,
              border: `1px solid ${cfg.color}66`,
            }}
          >
            {cfg.mode}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {cfg.name} — Câu {exam.currentIdx + 1}/{exam.questions.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Đã trả lời {answeredCount}/{exam.questions.length}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Clock size={14} />
          {elapsedMin} / {cfg.durationMin} phút
        </div>
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              'Bỏ đề thi? Tiến độ làm bài hiện tại sẽ mất. Hành động không thể khôi phục.',
            );
            if (ok) onReset();
          }}
          className="text-xs px-2 h-7 rounded inline-flex items-center gap-1"
          style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
        >
          <RotateCcw size={11} /> Bỏ đề
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {exam.questions.map((_, i) => {
          const ans = exam.answers[i];
          const isCurrent = i === exam.currentIdx;
          const isAnswered = ans !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              className="inline-flex items-center justify-center text-[10px] font-bold w-7 h-7 rounded transition-colors"
              style={{
                background: isCurrent
                  ? 'var(--color-accent-primary)'
                  : isAnswered
                    ? 'var(--color-surface-muted)'
                    : 'transparent',
                color: isCurrent
                  ? '#ffffff'
                  : isAnswered
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-muted)',
                border: isCurrent
                  ? 'none'
                  : `1px solid var(--color-border-${isAnswered ? 'default' : 'subtle'})`,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      <section
        className="rounded-xl border p-6 md:p-7 mb-5"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        {q.isCritical && (
          <div
            className="inline-flex items-center gap-1.5 mb-3 px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(239,68,68,0.14)', color: '#EF4444' }}
          >
            ⚠ Câu liệt — sai là rớt
          </div>
        )}
        <h2
          className="text-lg md:text-xl font-semibold mb-5 leading-relaxed"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {q.question}
        </h2>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
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
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm md:text-base">{opt}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom actions */}
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
                const ok = window.confirm(
                  `Nộp bài? Bạn còn ${exam.questions.length - answeredCount} câu chưa trả lời.`,
                );
                if (!ok) return;
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
// View: Result
// ============================================================
function ResultView({
  mode,
  result,
  onReset,
}: {
  mode: DrivingMode;
  result: ExamResult;
  onReset: () => void;
}) {
  const cfg = MODE_CONFIGS[mode];
  const wrongs = useMemo(
    () => result.details.filter((d) => !d.isCorrect),
    [result],
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      {/* Hero */}
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
            background: result.passed
              ? 'rgba(16,185,129,0.18)'
              : 'rgba(239,68,68,0.18)',
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
        <p
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {result.correctCount} / {result.total}
        </p>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {cfg.name} — yêu cầu đậu ≥ {result.passingScore}/{result.total}
        </p>
        {result.criticalWrong > 0 && (
          <p
            className="inline-block px-3 py-1.5 rounded text-xs font-bold mb-3"
            style={{ background: 'rgba(239,68,68,0.14)', color: '#EF4444' }}
          >
            ⚠ Sai {result.criticalWrong} câu liệt — tự động rớt
          </p>
        )}
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

      {/* Detail review */}
      <section>
        <h2
          className="text-sm font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
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

function ReviewCard({
  index,
  detail,
}: {
  index: number;
  detail: ExamResult['details'][number];
}) {
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
          <p
            className="text-xs mb-1 inline-block"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Câu {index + 1}
            {question.isCritical && (
              <span
                className="ml-2 inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase"
                style={{ background: 'rgba(239,68,68,0.14)', color: '#EF4444' }}
              >
                Liệt
              </span>
            )}
          </p>
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {question.question}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 ml-8">
        {question.options.map((opt, i) => {
          const isSelected = selectedIndex === i;
          const isCorrectOpt = i === question.correctIndex;
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
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded text-xs"
              style={{ background: bg, border: `1px solid ${bd}` }}
            >
              <span
                className="font-bold shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {String.fromCharCode(65 + i)}.
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
      {question.explanation && (
        <p
          className="text-xs mt-3 ml-8 italic"
          style={{ color: 'var(--color-text-muted)' }}
        >
          💡 {question.explanation}
        </p>
      )}
    </article>
  );
}

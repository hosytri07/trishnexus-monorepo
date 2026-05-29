/**
 * Phase 78.13 — Scheduled Tasks runner hook.
 *
 * Trong App.tsx của TrishUtilities, mount `useScheduledTasksRunner()` để
 * mỗi 60s check tasks của user hiện tại; task nào tới hạn (nextRun <= now)
 * và `deviceId` khớp với máy hiện tại thì chạy.
 *
 * Tránh chạy trùng: chỉ device nào tạo task mới tự động chạy (deviceId fixed).
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  listScheduledTasksForUser,
  updateScheduledTask,
} from './firestore.js';
import { computeNextRun } from './cadence.js';
import { executeTask } from './executor.js';
import { getDeviceId } from './device.js';
import type { ScheduledTask } from './types.js';

const POLL_INTERVAL_MS = 60_000; // 1 phút

/** Hook chạy 1 lần ở root App. */
export function useScheduledTasksRunner(): void {
  const { firebaseUser } = useAuth();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const deviceId = getDeviceId();

    let cancelled = false;

    async function tick(): Promise<void> {
      if (runningRef.current || cancelled) return;
      runningRef.current = true;
      try {
        const tasks = await listScheduledTasksForUser(uid).catch(() => []);
        const now = Date.now();
        const due = tasks.filter(
          (t) => t.enabled && t.deviceId === deviceId && t.nextRun <= now,
        );
        for (const t of due) {
          if (cancelled) break;
          await runOne(t);
        }
      } finally {
        runningRef.current = false;
      }
    }

    // Chạy tick đầu sau 5s (để app load xong), sau đó 60s/lần.
    const initial = setTimeout(() => void tick(), 5_000);
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [firebaseUser?.uid]);
}

async function runOne(task: ScheduledTask): Promise<void> {
  // Mark running.
  await updateScheduledTask(task.id, { lastStatus: 'running' }).catch(() => {});
  try {
    const { summary } = await executeTask(task.kind);
    await updateScheduledTask(task.id, {
      lastStatus: 'success',
      lastRun: Date.now(),
      lastSummary: summary,
      lastError: undefined,
      nextRun: computeNextRun(task.cadence),
    });
  } catch (err) {
    await updateScheduledTask(task.id, {
      lastStatus: 'error',
      lastRun: Date.now(),
      lastError: err instanceof Error ? err.message : String(err),
      // Vẫn tính nextRun để không retry liên tục.
      nextRun: computeNextRun(task.cadence),
    }).catch(() => {});
  }
}

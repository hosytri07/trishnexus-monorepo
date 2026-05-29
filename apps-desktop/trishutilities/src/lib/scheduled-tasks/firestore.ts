/**
 * Phase 78.13 — Scheduled Tasks Firestore CRUD.
 *
 * Collection: scheduled_tasks/{taskId}
 * Indexed: uid (asc), nextRun (asc).
 *
 * Doc id = `${uid}_${rand}` để rules cho phép user chỉ đọc/ghi doc của mình
 * mà không cần subcollection.
 */
import { getFirebaseDb } from '@trishteam/auth';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { ScheduledTask, ScheduledTaskCadence, ScheduledTaskKind } from './types.js';
import { computeNextRun } from './cadence.js';

const COLLECTION = 'scheduled_tasks';

function newTaskId(uid: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${uid}_${Date.now().toString(36)}_${rand}`;
}

export interface CreateTaskInput {
  uid: string;
  name: string;
  kind: ScheduledTaskKind;
  cadence: ScheduledTaskCadence;
  deviceId: string;
  deviceName?: string;
  enabled?: boolean;
}

export async function createScheduledTask(input: CreateTaskInput): Promise<ScheduledTask> {
  const db = getFirebaseDb();
  const id = newTaskId(input.uid);
  const now = Date.now();
  const task: ScheduledTask = {
    id,
    uid: input.uid,
    name: input.name,
    kind: input.kind,
    cadence: input.cadence,
    enabled: input.enabled ?? true,
    nextRun: computeNextRun(input.cadence, now),
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, COLLECTION, id), {
    ...task,
    serverUpdatedAt: serverTimestamp(),
  });
  return task;
}

export async function updateScheduledTask(
  id: string,
  patch: Partial<Pick<ScheduledTask, 'name' | 'cadence' | 'enabled' | 'nextRun' | 'lastRun' | 'lastStatus' | 'lastError' | 'lastSummary'>>,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: Date.now(),
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function deleteScheduledTask(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Liệt kê tasks của 1 user, sort theo nextRun. */
export async function listScheduledTasksForUser(uid: string): Promise<ScheduledTask[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('uid', '==', uid), orderBy('nextRun', 'asc')),
  );
  return snap.docs.map((d) => d.data() as ScheduledTask);
}

/** Admin: liệt kê toàn bộ tasks (giới hạn 500). */
export async function listAllScheduledTasks(): Promise<ScheduledTask[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('nextRun', 'asc')),
  );
  return snap.docs.slice(0, 500).map((d) => d.data() as ScheduledTask);
}

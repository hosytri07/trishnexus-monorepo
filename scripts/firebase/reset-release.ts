#!/usr/bin/env -S ts-node
/**
 * reset-release.ts — Phase 11.9 (ghi sẵn để dùng khi release).
 *
 * Wipe toàn bộ data test trong Firestore + Firebase Auth, giữ lại duy nhất
 * các account trong danh sách KEEP_EMAILS (admin của Trí), sau đó seed lại
 * 1 announcement welcome để dashboard không trống.
 *
 * CẢNH BÁO: chạy xong là MẤT TOÀN BỘ DATA, chỉ dùng 1 lần ngay trước lúc
 * release. Script bắt buộc pass flag --i-know-what-im-doing.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json \
 *     npx ts-node scripts/firebase/reset-release.ts --i-know-what-im-doing
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

/** Giữ lại không xoá. Email ở đây sẽ tồn tại sau reset. */
const KEEP_EMAILS: string[] = [
  'hosytri77@gmail.com',
  'trishteam.official@gmail.com',
];

/** Collections root-level cần purge. /notes/{uid}/items/* đi riêng. */
const PURGE_COLLECTIONS = [
  'users',
  'announcements',
  'feedback',
  'audit',
  'posts',
];

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

async function deleteCollection(db: FirebaseFirestore.Firestore, name: string) {
  const col = db.collection(name);
  const snap = await col.get();
  if (snap.empty) return 0;
  const batchSize = 400;
  let total = 0;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = snap.docs.slice(i, i + batchSize);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += chunk.length;
  }
  return total;
}

async function deleteNotesSubcollections(db: FirebaseFirestore.Firestore) {
  const usersSnap = await db.collection('notes').listDocuments();
  let total = 0;
  for (const userDoc of usersSnap) {
    const items = await userDoc.collection('items').get();
    for (let i = 0; i < items.docs.length; i += 400) {
      const batch = db.batch();
      items.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += Math.min(400, items.docs.length - i);
    }
    await userDoc.delete();
  }
  return total;
}

/**
 * Phase 11.7 — purge subcollections bên trong /users/{uid}:
 *   - /users/{uid}/events  (activity feed)
 *   - /users/{uid}/progress (app state)
 *
 * Gọi TRƯỚC khi xoá /users/{uid} để không để lại orphan subcollections.
 * Bỏ qua uid đang trong keep list để giữ lại admin audit.
 */
async function deleteUserSubcollections(
  db: FirebaseFirestore.Firestore,
  keepUids: Set<string>,
) {
  const userDocs = await db.collection('users').listDocuments();
  let totalEvents = 0;
  let totalProgress = 0;
  for (const userDoc of userDocs) {
    if (keepUids.has(userDoc.id)) continue;
    for (const sub of ['events', 'progress'] as const) {
      const col = await userDoc.collection(sub).get();
      for (let i = 0; i < col.docs.length; i += 400) {
        const batch = db.batch();
        col.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (sub === 'events') totalEvents += Math.min(400, col.docs.length - i);
        else totalProgress += Math.min(400, col.docs.length - i);
      }
    }
  }
  return { totalEvents, totalProgress };
}

async function main() {
  if (!hasFlag('--i-know-what-im-doing')) {
    console.error('Từ chối: thiếu flag --i-know-what-im-doing');
    process.exit(1);
  }

  // Init admin SDK
  const saPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './secrets/service-account.json',
  );
  if (fs.existsSync(saPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log('');
  console.log('================ TRISHTEAM RELEASE RESET ================');
  console.log('Sẽ xoá TOÀN BỘ:');
  console.log(`  - Firebase Auth users (trừ: ${KEEP_EMAILS.join(', ')})`);
  console.log(`  - Firestore collections: ${PURGE_COLLECTIONS.join(', ')}`);
  console.log('  - Toàn bộ /notes/{uid}/items (subcollections)');
  console.log('');

  const ok = await confirm('Gõ "yes" để xác nhận xoá: ');
  if (!ok) {
    console.log('Huỷ.');
    return;
  }

  // 1. Lookup keepers, thu uid
  const keepUids = new Set<string>();
  for (const e of KEEP_EMAILS) {
    try {
      const u = await auth.getUserByEmail(e);
      keepUids.add(u.uid);
      console.log(`KEEP ${e} → ${u.uid}`);
    } catch {
      console.log(`(không có user ${e}, bỏ qua)`);
    }
  }

  // 2. Delete Firebase Auth users not in keep list
  let nextPageToken: string | undefined;
  let deletedAuth = 0;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    const toDelete = page.users
      .filter((u) => !keepUids.has(u.uid))
      .map((u) => u.uid);
    if (toDelete.length > 0) {
      const res = await auth.deleteUsers(toDelete);
      deletedAuth += res.successCount;
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  console.log(`Auth: xoá ${deletedAuth} user(s).`);

  // 3. Purge subcollections bên trong /users/{uid} trước
  //    (events + progress — Phase 11.7). Giữ lại của keepers.
  const { totalEvents, totalProgress } = await deleteUserSubcollections(
    db,
    keepUids,
  );
  console.log(
    `Firestore: xoá ${totalEvents} event(s) + ${totalProgress} progress doc(s).`,
  );

  // 4. Purge collections root-level
  for (const name of PURGE_COLLECTIONS) {
    const n = await deleteCollection(db, name);
    console.log(`Firestore: xoá ${n} doc(s) trong /${name}.`);
  }
  const notesDeleted = await deleteNotesSubcollections(db);
  console.log(`Firestore: xoá ${notesDeleted} note(s) trong /notes/*/items.`);

  // 5. Re-seed admin profile cho keepers
  for (const uid of keepUids) {
    const u = await auth.getUser(uid);
    await db.collection('users').doc(uid).set({
      id: uid,
      name: u.displayName ?? u.email?.split('@')[0] ?? 'Admin',
      email: u.email ?? '',
      role: 'admin',
      plan: 'Admin',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(`Firestore: re-seed ${keepUids.size} admin profile.`);

  // 6. Seed welcome announcement
  await db.collection('announcements').add({
    title: 'Chào mừng đến với TrishTEAM!',
    message:
      'Đây là ngày đầu TrishTEAM chính thức mở public. Chúc bạn làm việc hiệu quả.',
    kind: 'info',
    active: true,
    dismissible: true,
    startAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('Firestore: seed 1 welcome announcement.');

  console.log('');
  console.log('================ DONE ================');
  console.log('Release state: production-ready.');
}

main().catch((err) => {
  console.error('Lỗi reset-release:', err);
  process.exit(1);
});

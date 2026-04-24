#!/usr/bin/env -S ts-node
/**
 * seed-admin.ts — Phase 11.6.5
 *
 * Set role='admin' cho 1 Firebase Auth user (theo email hoặc uid), đồng thời
 * ghi/update doc /users/{uid} với role='admin' + plan='Admin'. Dùng Firebase
 * Admin SDK nên bypass security rules — chỉ chạy local với service account.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json \
 *     npx ts-node scripts/firebase/seed-admin.ts --email hosytri77@gmail.com
 *
 * Hoặc:
 *   npx ts-node scripts/firebase/seed-admin.ts --uid <uid>
 *
 * Trước khi chạy:
 *   1. Firebase Console → Project settings → Service accounts →
 *      "Generate new private key" → lưu JSON vào ./secrets/service-account.json
 *   2. Tạo account target bằng cách register trên web bình thường.
 *   3. Chạy lệnh trên với email của account đó.
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';

function parseArgs(): { email?: string; uid?: string } {
  const out: { email?: string; uid?: string } = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--email') out.email = process.argv[++i];
    else if (a === '--uid') out.uid = process.argv[++i];
  }
  return out;
}

async function main() {
  const { email, uid } = parseArgs();
  if (!email && !uid) {
    console.error('Cần --email <email> hoặc --uid <uid>');
    process.exit(1);
  }

  // Init admin SDK — ưu tiên GOOGLE_APPLICATION_CREDENTIALS env,
  // fallback ./secrets/service-account.json
  const saPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './secrets/service-account.json',
  );
  if (fs.existsSync(saPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }

  const auth = getAuth();
  const db = getFirestore();

  // 1. Lookup user
  const userRec = email
    ? await auth.getUserByEmail(email)
    : await auth.getUser(uid!);
  console.log(`✓ Found user ${userRec.uid} (${userRec.email ?? 'no email'})`);

  // 2. Set custom claim
  await auth.setCustomUserClaims(userRec.uid, { admin: true });
  console.log(`✓ Set custom claim { admin: true }`);

  // 3. Upsert Firestore profile
  const ref = db.collection('users').doc(userRec.uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({
      role: 'admin',
      plan: 'Admin',
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Updated /users/${userRec.uid} → role='admin'`);
  } else {
    await ref.set({
      id: userRec.uid,
      name: userRec.displayName ?? userRec.email?.split('@')[0] ?? 'Admin',
      email: userRec.email ?? '',
      role: 'admin',
      plan: 'Admin',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Created /users/${userRec.uid} → role='admin'`);
  }

  console.log('');
  console.log('DONE. Người dùng này đã là admin.');
  console.log('Nhắc: họ cần logout + login lại để custom claim có hiệu lực.');
}

main().catch((err) => {
  console.error('Lỗi seed-admin:', err);
  process.exit(1);
});

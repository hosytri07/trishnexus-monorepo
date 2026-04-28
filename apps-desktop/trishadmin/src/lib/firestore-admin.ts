/**
 * Phase 18.7.a — Firestore admin helpers.
 *
 * Wrapper quanh @trishteam/auth Firebase init + paths để fetch/update users,
 * keys, announcements (broadcasts). Mọi op đều cần admin role qua Firestore
 * Security Rules; nếu rule chặn → throw lỗi readable.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import {
  paths,
  type ActivationKey,
  type TrishUser,
  type UserRole,
} from '@trishteam/data';
import { generateActivationKey, generateBroadcastId, generateKeyId } from './key-gen.js';

// ============================================================
// Users
// ============================================================

export async function listUsers(limit = 200): Promise<TrishUser[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.users()),
    orderBy('created_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  // Inject doc.id nếu doc không có field id (legacy docs Firestore Console)
  return snap.docs.map((d) => {
    const data = d.data() as Partial<TrishUser>;
    return { ...data, id: data.id ?? d.id } as TrishUser;
  });
}

export async function getUser(uid: string): Promise<TrishUser | null> {
  const db = getFirebaseDb();
  const ref = doc(db, paths.user(uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as TrishUser;
}

export interface ActorContext {
  uid: string;
  email?: string;
}

export async function setUserRole(
  uid: string,
  role: UserRole,
  actor?: ActorContext,
  targetEmail?: string,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, paths.user(uid));
  await updateDoc(ref, {
    role,
    role_updated_at: Date.now(),
  });
  if (actor) {
    await writeAudit({
      action: 'user.set_role',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'user',
      target_id: uid,
      target_label: targetEmail,
      details: { new_role: role },
    });
  }
}

export async function resetUserToTrial(
  uid: string,
  actor?: ActorContext,
  targetEmail?: string,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, paths.user(uid));
  await updateDoc(ref, {
    role: 'trial' as UserRole,
    key_activated_at: 0,
    activated_key_id: null,
    role_updated_at: Date.now(),
  });
  if (actor) {
    await writeAudit({
      action: 'user.reset_trial',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'user',
      target_id: uid,
      target_label: targetEmail,
    });
  }
}

/**
 * Xóa hẳn doc user khỏi Firestore.
 *
 * Lưu ý: Firebase Auth user (email/password) vẫn tồn tại — cần Cloud Function
 * `firebase-admin.auth().deleteUser(uid)` để xóa hẳn. Xóa Firestore doc làm:
 *   - User mất role + data tracking
 *   - Lần login tiếp theo, ensureUserDoc() tự tạo lại với role 'trial'
 *
 * Nếu cần ban hẳn → dùng Cloud Function block Auth.
 */
export async function deleteUserDoc(
  uid: string,
  actor?: ActorContext,
  targetEmail?: string,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, paths.user(uid));
  await deleteDoc(ref);
  if (actor) {
    await writeAudit({
      action: 'user.delete_doc',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'user',
      target_id: uid,
      target_label: targetEmail,
    });
  }
}

// ============================================================
// Activation Keys
// ============================================================

export async function listKeys(limit = 200): Promise<ActivationKey[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.keys()),
    orderBy('created_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<ActivationKey>;
    return { ...data, id: data.id ?? d.id } as ActivationKey;
  });
}

export async function listKeysByStatus(
  status: ActivationKey['status'],
  limit = 200,
): Promise<ActivationKey[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.keys()),
    where('status', '==', status),
    orderBy('created_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<ActivationKey>;
    return { ...data, id: data.id ?? d.id } as ActivationKey;
  });
}

export interface CreateKeyInput {
  count: number;
  note?: string;
  expiresAt?: number;
  createdByUid: string;
}

/** Strip mọi field undefined trước khi gửi setDoc — Firestore không cho phép. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k of Object.keys(obj) as Array<keyof T>) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export async function createKeys(
  input: CreateKeyInput,
  actor?: ActorContext,
): Promise<ActivationKey[]> {
  const db = getFirebaseDb();
  const now = Date.now();
  const out: ActivationKey[] = [];
  for (let i = 0; i < input.count; i++) {
    const id = generateKeyId();
    const code = generateActivationKey();
    const k: ActivationKey = {
      id,
      code,
      status: 'active',
      ...(input.note ? { note: input.note } : {}),
      expires_at: input.expiresAt ?? 0,
      created_at: now,
      created_by_uid: input.createdByUid,
    };
    await setDoc(doc(db, paths.key(id)), stripUndefined(k as Record<string, unknown>));
    out.push(k);
  }
  if (actor) {
    await writeAudit({
      action: 'key.create_batch',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'key',
      details: {
        count: input.count,
        note: input.note,
        expires_at: input.expiresAt ?? 0,
        codes: out.map((k) => k.code),
      },
    });
  }
  return out;
}

export async function revokeKey(
  keyId: string,
  actor?: ActorContext,
  code?: string,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, paths.key(keyId)), {
    status: 'revoked' as ActivationKey['status'],
  });
  if (actor) {
    await writeAudit({
      action: 'key.revoke',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'key',
      target_id: keyId,
      target_label: code,
    });
  }
}

export async function deleteKey(
  keyId: string,
  actor?: ActorContext,
  code?: string,
): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, paths.key(keyId)));
  if (actor) {
    await writeAudit({
      action: 'key.delete',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'key',
      target_id: keyId,
      target_label: code,
    });
  }
}

// ============================================================
// Broadcasts (announcements)
// ============================================================

export type BroadcastSeverity = 'info' | 'warning' | 'critical';
export type BroadcastAudience = 'all' | 'paid' | 'trial' | 'admin';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  severity: BroadcastSeverity;
  audience: BroadcastAudience;
  created_at: number;
  /** Timestamp ms hết hạn — 0 = không bao giờ */
  expires_at: number;
  created_by_uid: string;
  active: boolean;
}

export async function listBroadcasts(limit = 100): Promise<Broadcast[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.announcements()),
    orderBy('created_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Broadcast>;
    return { ...data, id: data.id ?? d.id } as Broadcast;
  });
}

export interface CreateBroadcastInput {
  title: string;
  body: string;
  severity: BroadcastSeverity;
  audience: BroadcastAudience;
  expiresAt: number;
  createdByUid: string;
}

export async function createBroadcast(
  input: CreateBroadcastInput,
  actor?: ActorContext,
): Promise<Broadcast> {
  const db = getFirebaseDb();
  const id = generateBroadcastId();
  const b: Broadcast = {
    id,
    title: input.title,
    body: input.body,
    severity: input.severity,
    audience: input.audience,
    expires_at: input.expiresAt,
    created_at: Date.now(),
    created_by_uid: input.createdByUid,
    active: true,
  };
  await setDoc(
    doc(db, paths.announcement(id)),
    stripUndefined({
      ...b,
      _server_created_at: serverTimestamp(),
    } as Record<string, unknown>),
  );
  if (actor) {
    await writeAudit({
      action: 'broadcast.create',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'broadcast',
      target_id: id,
      target_label: input.title,
      details: {
        severity: input.severity,
        audience: input.audience,
        expires_at: input.expiresAt,
      },
    });
  }
  return b;
}

export async function setBroadcastActive(
  id: string,
  active: boolean,
  actor?: ActorContext,
  title?: string,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, paths.announcement(id)), { active });
  if (actor) {
    await writeAudit({
      action: active ? 'broadcast.activate' : 'broadcast.deactivate',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'broadcast',
      target_id: id,
      target_label: title,
    });
  }
}

export async function deleteBroadcast(
  id: string,
  actor?: ActorContext,
  title?: string,
): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, paths.announcement(id)));
  if (actor) {
    await writeAudit({
      action: 'broadcast.delete',
      actor_uid: actor.uid,
      actor_email: actor.email,
      target_type: 'broadcast',
      target_id: id,
      target_label: title,
    });
  }
}

// ============================================================
// Stats helpers
// ============================================================

export interface AdminStats {
  totalUsers: number;
  byRole: Record<UserRole, number>;
  signups7d: number;
  activeKeys: number;
  usedKeys: number;
  revokedKeys: number;
  activeBroadcasts: number;
}

export async function fetchStats(): Promise<AdminStats> {
  const [users, keys, broadcasts] = await Promise.all([
    listUsers(1000),
    listKeys(1000),
    listBroadcasts(200),
  ]);
  const byRole: Record<UserRole, number> = { trial: 0, user: 0, admin: 0 };
  let signups7d = 0;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const u of users) {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    if (u.created_at >= sevenDaysAgo) signups7d++;
  }
  let activeKeys = 0;
  let usedKeys = 0;
  let revokedKeys = 0;
  for (const k of keys) {
    if (k.status === 'active') activeKeys++;
    else if (k.status === 'used') usedKeys++;
    else if (k.status === 'revoked') revokedKeys++;
  }
  const activeBroadcasts = broadcasts.filter((b) => b.active).length;
  return {
    totalUsers: users.length,
    byRole,
    signups7d,
    activeKeys,
    usedKeys,
    revokedKeys,
    activeBroadcasts,
  };
}

// ============================================================
// Phase 18.8.a — TrishTEAM Library curator
// Collection /trishteam_library/{folderId}
//   subcollection /links/{linkId}
// Admin write, all signed-in user read.
// ============================================================

export interface TrishteamLibraryFolder {
  id: string;
  name: string;
  description?: string;
  icon?: string; // emoji
  sort_order: number;
  link_count?: number;
  created_at: number;
  updated_at: number;
  created_by_uid: string;
}

export interface TrishteamLibraryLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string; // emoji
  link_type?: 'web' | 'pdf' | 'docs' | 'video' | 'other';
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export async function listLibraryFolders(): Promise<TrishteamLibraryFolder[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.trishteamLibraryFolders()),
    orderBy('sort_order', 'asc'),
    fbLimit(200),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<TrishteamLibraryFolder>;
    return { ...data, id: data.id ?? d.id } as TrishteamLibraryFolder;
  });
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  icon?: string;
  createdByUid: string;
}

export async function createLibraryFolder(
  input: CreateFolderInput,
): Promise<TrishteamLibraryFolder> {
  const db = getFirebaseDb();
  const folders = await listLibraryFolders();
  const sortOrder = folders.length > 0 ? Math.max(...folders.map((f) => f.sort_order)) + 1 : 0;
  const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const f: TrishteamLibraryFolder = {
    id,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    sort_order: sortOrder,
    link_count: 0,
    created_at: now,
    updated_at: now,
    created_by_uid: input.createdByUid,
  };
  await setDoc(
    doc(db, paths.trishteamLibraryFolder(id)),
    stripUndefined(f as Record<string, unknown>),
  );
  return f;
}

export async function updateLibraryFolder(
  id: string,
  patch: Partial<Pick<TrishteamLibraryFolder, 'name' | 'description' | 'icon' | 'sort_order'>>,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, paths.trishteamLibraryFolder(id)), {
    ...stripUndefined(patch as Record<string, unknown>),
    updated_at: Date.now(),
  });
}

export async function deleteLibraryFolder(id: string): Promise<void> {
  const db = getFirebaseDb();
  // Note: Firestore không cascade delete subcollection. Phải xóa links trước.
  const links = await listLibraryLinks(id);
  for (const l of links) {
    await deleteDoc(doc(db, paths.trishteamLibraryLink(id, l.id)));
  }
  await deleteDoc(doc(db, paths.trishteamLibraryFolder(id)));
}

export async function listLibraryLinks(folderId: string): Promise<TrishteamLibraryLink[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, paths.trishteamLibraryLinks(folderId)),
    orderBy('sort_order', 'asc'),
    fbLimit(500),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<TrishteamLibraryLink>;
    return { ...data, id: data.id ?? d.id } as TrishteamLibraryLink;
  });
}

export interface CreateLinkInput {
  folderId: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  link_type?: TrishteamLibraryLink['link_type'];
}

export async function createLibraryLink(
  input: CreateLinkInput,
): Promise<TrishteamLibraryLink> {
  const db = getFirebaseDb();
  const existing = await listLibraryLinks(input.folderId);
  const sortOrder = existing.length > 0 ? Math.max(...existing.map((l) => l.sort_order)) + 1 : 0;
  const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const l: TrishteamLibraryLink = {
    id,
    title: input.title,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.link_type ? { link_type: input.link_type } : {}),
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };
  await setDoc(
    doc(db, paths.trishteamLibraryLink(input.folderId, id)),
    stripUndefined(l as Record<string, unknown>),
  );
  // Touch folder updated_at để client biết folder có thay đổi
  await updateDoc(doc(db, paths.trishteamLibraryFolder(input.folderId)), {
    updated_at: Date.now(),
  });
  return l;
}

export async function updateLibraryLink(
  folderId: string,
  linkId: string,
  patch: Partial<Pick<
    TrishteamLibraryLink,
    'title' | 'url' | 'description' | 'icon' | 'link_type' | 'sort_order'
  >>,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, paths.trishteamLibraryLink(folderId, linkId)), {
    ...stripUndefined(patch as Record<string, unknown>),
    updated_at: Date.now(),
  });
}

export async function deleteLibraryLink(folderId: string, linkId: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, paths.trishteamLibraryLink(folderId, linkId)));
}

// ============================================================
// Phase 18.8.a — Feedback inbox
// Collection /feedback/{id}
// User create với uid = mình. Admin read all + update + delete.
// ============================================================

export interface Feedback {
  id: string;
  uid: string;
  email?: string;
  display_name?: string;
  app: string; // 'trishlibrary' | 'trishadmin' | 'trishlauncher' | etc
  app_version?: string;
  category: 'bug' | 'feature' | 'question' | 'praise' | 'other';
  message: string;
  /** Trạng thái xử lý */
  status: 'new' | 'read' | 'in_progress' | 'resolved' | 'wontfix';
  admin_note?: string;
  created_at: number;
  resolved_at?: number;
  resolved_by_uid?: string;
}

export async function listFeedback(limit = 200): Promise<Feedback[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'feedback'),
    orderBy('created_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Feedback>;
    return { ...data, id: data.id ?? d.id } as Feedback;
  });
}

export async function setFeedbackStatus(
  id: string,
  status: Feedback['status'],
  adminUid: string,
  adminNote?: string,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, `feedback/${id}`), {
    status,
    ...(adminNote ? { admin_note: adminNote } : {}),
    ...(status === 'resolved' || status === 'wontfix'
      ? { resolved_at: Date.now(), resolved_by_uid: adminUid }
      : {}),
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, `feedback/${id}`));
}

// ============================================================
// Phase 18.8.a — Audit log
// Collection /audit/{id} — append-only. Admin read.
// Mỗi action admin (createKey, revokeKey, setUserRole, deleteUser, ...)
// ghi 1 entry.
// ============================================================

export interface AuditEntry {
  id: string;
  action: string;
  actor_uid: string;
  actor_email?: string;
  target_type?: string; // 'user' | 'key' | 'broadcast' | 'library_folder' | ...
  target_id?: string;
  target_label?: string; // human-readable (vd email, key code)
  details?: Record<string, unknown>; // tự do, JSON
  created_at: number;
}

export async function writeAudit(input: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void> {
  const db = getFirebaseDb();
  const entry = {
    ...stripUndefined(input as Record<string, unknown>),
    created_at: Date.now(),
    _server_created_at: serverTimestamp(),
  };
  try {
    // Dùng addDoc → Firestore tự sinh ID (không cần custom ID cho audit)
    await addDoc(collection(db, 'audit'), entry);
  } catch (err) {
    // Audit fail không nên block action chính → log warn rồi swallow
    console.warn('[trishadmin] writeAudit fail:', err);
  }
}

export async function listAudit(limit = 300): Promise<AuditEntry[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'audit'), orderBy('created_at', 'desc'), fbLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<AuditEntry>;
    return { ...data, id: data.id ?? d.id } as AuditEntry;
  });
}

// ============================================================
// Phase 18.8.a — Posts (blog/changelog public)
// Collection /posts/{id}
// Status: draft | published. Public read khi published. Admin CRUD.
// ============================================================

export interface Post {
  id: string;
  title: string;
  slug: string;
  body_md: string; // markdown source
  excerpt?: string;
  hero_url?: string;
  tags?: string[];
  status: 'draft' | 'published';
  /** Timestamp ms khi publish (= created_at nếu publish luôn) */
  publish_at?: number;
  created_at: number;
  updated_at: number;
  author_uid: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listPosts(limit = 200): Promise<Post[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'posts'),
    orderBy('updated_at', 'desc'),
    fbLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Post>;
    return { ...data, id: data.id ?? d.id } as Post;
  });
}

export interface CreatePostInput {
  title: string;
  body_md: string;
  excerpt?: string;
  hero_url?: string;
  tags?: string[];
  status: 'draft' | 'published';
  authorUid: string;
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const db = getFirebaseDb();
  const slug = slugify(input.title) + '-' + Date.now().toString(36).slice(-4);
  const id = slug;
  const now = Date.now();
  const p: Post = {
    id,
    title: input.title,
    slug,
    body_md: input.body_md,
    ...(input.excerpt ? { excerpt: input.excerpt } : {}),
    ...(input.hero_url ? { hero_url: input.hero_url } : {}),
    ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    status: input.status,
    ...(input.status === 'published' ? { publish_at: now } : {}),
    created_at: now,
    updated_at: now,
    author_uid: input.authorUid,
  };
  await setDoc(doc(db, `posts/${id}`), stripUndefined(p as Record<string, unknown>));
  return p;
}

export async function updatePost(
  id: string,
  patch: Partial<Omit<Post, 'id' | 'created_at' | 'author_uid'>>,
): Promise<void> {
  const db = getFirebaseDb();
  const next: Record<string, unknown> = {
    ...patch,
    updated_at: Date.now(),
  };
  // Nếu status đổi sang published lần đầu thì set publish_at
  if (patch.status === 'published' && !patch.publish_at) {
    next.publish_at = Date.now();
  }
  await updateDoc(doc(db, `posts/${id}`), stripUndefined(next));
}

export async function deletePost(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, `posts/${id}`));
}

// ============================================================
// Format helpers
// ============================================================

export function formatTimestamp(ts: number | Timestamp | undefined | null): string {
  if (!ts) return '—';
  const ms = ts instanceof Timestamp ? ts.toMillis() : ts;
  if (!ms || isNaN(ms)) return '—';
  const d = new Date(ms);
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(ms: number | undefined | null): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return 'tương lai';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'vừa xong';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h trước`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} ngày trước`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} tháng trước`;
  return `${Math.floor(month / 12)} năm trước`;
}

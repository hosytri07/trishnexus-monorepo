/**
 * @trishteam/data — Firebase collection paths + type-safe readers/writers.
 *
 * Phase 14.0 scaffold. Collection path string hardcoded ở nhiều chỗ trong
 * website hiện tại — centralize ở đây để tránh drift khi thêm collection
 * mới hoặc đổi schema.
 */

/**
 * Path helpers — chỉ trả string, không dùng Firebase type để file này dùng
 * được ở server (Admin SDK), client (Web SDK), hoặc Zalo (Firebase Web SDK).
 */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  userEvent: (uid: string, eventId: string) =>
    `users/${uid}/events/${eventId}`,
  userEvents: (uid: string) => `users/${uid}/events`,
  userNote: (uid: string, noteId: string) =>
    `users/${uid}/notes/${noteId}`,
  userNotes: (uid: string) => `users/${uid}/notes`,
  announcement: (id: string) => `announcements/${id}`,
  announcements: () => 'announcements',
  vitalsSample: (env: string, id: string) =>
    `vitals/${env}/samples/${id}`,
  vitalsSamples: (env: string) => `vitals/${env}/samples`,
  errorSample: (env: string, id: string) =>
    `errors/${env}/samples/${id}`,
  errorSamples: (env: string) => `errors/${env}/samples`,
  semanticDoc: (kind: string, id: string) =>
    `semantic/${kind}/docs/${id}`,
} as const;

export type Env = 'prod' | 'dev' | 'preview';

export const DATA_VERSION = '0.1.0';

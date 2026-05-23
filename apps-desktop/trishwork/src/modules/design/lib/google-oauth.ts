/**
 * Phase 14.4.10 — Google OAuth Loopback flow client.
 *
 * Flow:
 *   1. Tauri command `start_google_oauth_loopback` mở browser ngoài
 *      → user chọn account Google (dùng session đã save trong Edge/Chrome)
 *      → Google redirect về http://127.0.0.1:RANDOM_PORT
 *      → Rust catch code + state + return cho frontend
 *
 *   2. Frontend exchange code → ID token (POST oauth2.googleapis.com/token)
 *
 *   3. Firebase signInWithCredential(GoogleAuthProvider.credential(idToken, accessToken))
 *      → user đăng nhập vào Firebase Auth
 */

import { invoke } from '@tauri-apps/api/core';
import {
  GoogleAuthProvider,
  signInWithCredential,
  type UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from '@trishteam/auth';

// OAuth Client ID + Secret (Desktop type) — không phải secret nhạy cảm
// theo Google docs vì desktop apps không thể giấu trong binary.
// Bảo mật flow nằm ở PKCE + state token + Firebase Auth backend.
const OAUTH_CLIENT_ID =
  '487461805589-vhh4f9jluo71og9cse5aq1e0e12als5g.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';

interface LoopbackResult {
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function loginWithGoogleLoopback(): Promise<UserCredential> {
  // 1) Start loopback flow — Rust open browser + wait callback
  const loopback = await invoke<LoopbackResult>('start_google_oauth_loopback', {
    clientId: OAUTH_CLIENT_ID,
  });

  // 2) Exchange code → ID token
  const params = new URLSearchParams({
    code: loopback.code,
    code_verifier: loopback.codeVerifier,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    redirect_uri: loopback.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokens: TokenResponse = await res.json();
  if (tokens.error || !tokens.id_token) {
    throw new Error(
      `Token exchange thất bại: ${tokens.error ?? 'no_id_token'} — ${tokens.error_description ?? ''}`,
    );
  }

  // 3) Firebase signInWithCredential
  // Truyền cả idToken + accessToken — Firebase verify với Google.
  const credential = GoogleAuthProvider.credential(
    tokens.id_token,
    tokens.access_token ?? null,
  );
  return signInWithCredential(getFirebaseAuth(), credential);
}

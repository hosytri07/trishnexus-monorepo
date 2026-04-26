/**
 * @trishteam/auth — Firebase app singleton.
 *
 * Phase 16.1.b. Init lazy 1 lần cho cả website + desktop apps + Zalo.
 *
 * Firebase config keys KHÔNG phải secret theo Firebase docs
 * (https://firebase.google.com/docs/projects/api-keys) — bảo mật bằng
 * Firestore Security Rules + Authorized domains. OK hardcode.
 *
 * Project: trishTEAM (trishteam-17c2d) created 2026-04-25.
 */

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import { type Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBj3hf6kRsGf-_X_pLLJ2TpN_Br1x4b96s',
  authDomain: 'trishteam-17c2d.firebaseapp.com',
  projectId: 'trishteam-17c2d',
  storageBucket: 'trishteam-17c2d.firebasestorage.app',
  messagingSenderId: '487461805589',
  appId: '1:487461805589:web:576e851228487f253a781c',
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  // Tránh duplicate init khi HMR
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }
  cachedApp = initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

export function getFirebaseDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

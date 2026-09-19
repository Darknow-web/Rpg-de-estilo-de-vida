/**
 * Inicialización de Firebase (cliente). Config pública por variables VITE_*.
 * Firestore con persistencia local: la app funciona offline y sincroniza sola.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) || appletConfig.apiKey,
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || appletConfig.authDomain,
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || appletConfig.projectId,
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) || appletConfig.appId,
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || appletConfig.messagingSenderId,
  firestoreDatabaseId: (env.VITE_FIREBASE_DATABASE_ID as string | undefined) || appletConfig.firestoreDatabaseId,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({
    apiKey: firebaseConfig.apiKey ?? 'missing',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId ?? 'demo-life-quest',
    appId: firebaseConfig.appId ?? 'missing',
    messagingSenderId: firebaseConfig.messagingSenderId,
  });
  return app;
}

export function auth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getApp());
  if (env.VITE_USE_EMULATORS === '1') {
    connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
  }
  return authInstance;
}

export function db(): Firestore {
  if (dbInstance) return dbInstance;
  const settings = {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  };
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  dbInstance = databaseId
    ? initializeFirestore(getApp(), settings, databaseId)
    : initializeFirestore(getApp(), settings);
  if (env.VITE_USE_EMULATORS === '1') {
    connectFirestoreEmulator(dbInstance, 'localhost', 8085);
  }
  return dbInstance;
}

"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

// Used for signInWithEmailAndPassword only. This app never reads Firestore
// from the browser; Firestore rules deny all client access.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function clientApp(): FirebaseApp {
  return getApps().length > 0 ? getApps()[0] : initializeApp(config);
}

export const clientAuth: Auth = getAuth(clientApp());
export const googleProvider = new GoogleAuthProvider();

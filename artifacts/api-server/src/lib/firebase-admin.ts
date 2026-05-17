import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "esim-45868";

if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
    if (pemMatch) {
      privateKey = pemMatch[0];
    }
  }

  if (clientEmail && privateKey) {
    const { cert } = await import("firebase-admin/app");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    const { applicationDefault } = await import("firebase-admin/app");
    try {
      initializeApp({ credential: applicationDefault(), projectId });
    } catch {
      initializeApp({ projectId });
    }
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();

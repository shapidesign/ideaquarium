/**
 * Key-Value store backed by Firebase Firestore (via Firebase Admin SDK).
 * Ported for Vercel Serverless (Node.js).
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COLLECTION = "kv_store";

function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

/** Encode key to a safe Firestore document ID (base64url, no slashes). */
function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Set stores a key-value pair.
export const set = async (key: string, value: any): Promise<void> => {
  const db = getDb();
  await db.collection(COLLECTION).doc(encodeKey(key)).set({ key, value });
};

// Get retrieves a value by key.
export const get = async (key: string): Promise<any> => {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(encodeKey(key)).get();
  return snap.exists ? snap.data()?.value : undefined;
};

// Delete deletes a key.
export const del = async (key: string): Promise<void> => {
  const db = getDb();
  await db.collection(COLLECTION).doc(encodeKey(key)).delete();
};

// Sets multiple key-value pairs in a batch.
export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const db = getDb();
  const batch = db.batch();
  keys.forEach((k, i) => {
    const ref = db.collection(COLLECTION).doc(encodeKey(k));
    batch.set(ref, { key: k, value: values[i] });
  });
  await batch.commit();
};

// Gets multiple values by keys.
export const mget = async (keys: string[]): Promise<any[]> => {
  const db = getDb();
  const refs = keys.map(k => db.collection(COLLECTION).doc(encodeKey(k)));
  const snaps = await db.getAll(...refs);
  return snaps.map(snap => (snap.exists ? snap.data()?.value : undefined));
};

// Deletes multiple keys in a batch.
export const mdel = async (keys: string[]): Promise<void> => {
  const db = getDb();
  const batch = db.batch();
  keys.forEach(k => {
    batch.delete(db.collection(COLLECTION).doc(encodeKey(k)));
  });
  await batch.commit();
};

// Search for entries whose original key starts with prefix.
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const db = getDb();
  // Query using the stored plain-text "key" field
  const snap = await db
    .collection(COLLECTION)
    .where("key", ">=", prefix)
    .where("key", "<", prefix + "\uffff")
    .get();
  return snap.docs.map(doc => doc.data().value);
};

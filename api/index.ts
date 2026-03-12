import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Admin Initialization ───────────────────────────────────────────
function getAdminApp() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
}

function getAdminAuthApp() {
  getAdminApp();
  return getAdminAuth();
}

function getDb() {
  getAdminApp();
  return getFirestore();
}

// ─── KV Store Logic ──────────────────────────────────────────────────────────
const COLLECTION = "kv_store";

function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── Native Handler ───────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req;
  console.log(`Request: ${req.method} ${url}`);

  try {
    // Health Check
    if (url.includes('/health')) {
      return res.status(200).json({ status: "ok", type: "native-node" });
    }

    // TODO: Implement other routes
    return res.status(404).json({ error: "Not found" });

  } catch (error: any) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}

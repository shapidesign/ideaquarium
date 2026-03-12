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

const kv = {
  set: async (key: string, value: any): Promise<void> => {
    const db = getDb();
    await db.collection(COLLECTION).doc(encodeKey(key)).set({ key, value });
  },
  get: async (key: string): Promise<any> => {
    const db = getDb();
    const snap = await db.collection(COLLECTION).doc(encodeKey(key)).get();
    return snap.exists ? snap.data()?.value : undefined;
  },
  del: async (key: string): Promise<void> => {
    const db = getDb();
    await db.collection(COLLECTION).doc(encodeKey(key)).delete();
  },
  mset: async (keys: string[], values: any[]): Promise<void> => {
    const db = getDb();
    const batch = db.batch();
    keys.forEach((k, i) => {
      const ref = db.collection(COLLECTION).doc(encodeKey(k));
      batch.set(ref, { key: k, value: values[i] });
    });
    await batch.commit();
  },
  mdel: async (keys: string[]): Promise<void> => {
    const db = getDb();
    const batch = db.batch();
    keys.forEach(k => {
      batch.delete(db.collection(COLLECTION).doc(encodeKey(k)));
    });
    await batch.commit();
  },
  getByPrefix: async (prefix: string): Promise<any[]> => {
    const db = getDb();
    const snap = await db
      .collection(COLLECTION)
      .where("key", ">=", prefix)
      .where("key", "<", prefix + "\uffff")
      .get();
    return snap.docs.map(doc => doc.data().value);
  }
};

// ─── Native Handler ───────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;
  console.log(`Request: ${method} ${url}`);

  try {
    // 1. Health Check
    if (url.includes('/health')) {
      return res.status(200).json({ status: "ok", type: "native-node" });
    }

    // Auth Helper Wrapper
    async function getAuthUser() {
      let idToken = req.headers['x-user-token'];
      if (!idToken) {
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          idToken = authHeader.split(' ')[1];
        }
      }
      if (!idToken) return { user: null, error: "Missing access token" };
      try {
        const adminAuth = getAdminAuthApp();
        const decoded = await adminAuth.verifyIdToken(idToken);
        return { user: decoded, error: null };
      } catch (err: any) {
        return { user: null, error: err.message || "Invalid token" };
      }
    }

    // Use a URL parser or simple suffix checks for routing
    const path = url.split('?')[0];

    // 2. Signup
    if (path.endsWith('/signup') && method === 'POST') {
      const { email, password, name } = req.body;
      const adminAuth = getAdminAuthApp();
      const userRecord = await adminAuth.createUser({ email, password, displayName: name });
      return res.status(200).json({ user: { id: userRecord.uid, email: userRecord.email } });
    }

    // 3. Ideas Batch Upload
    if (path.endsWith('/ideas/batch') && method === 'POST') {
      const { user, error } = await getAuthUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized', details: error });
      const { ideas } = req.body;
      if (!Array.isArray(ideas)) return res.status(400).json({ error: 'Invalid data' });
      if (ideas.length > 0) {
        const keys = ideas.map((idea: any) => `ideas:${user.uid}:${idea.id}`);
        await kv.mset(keys, ideas);
      }
      return res.status(200).json({ success: true, count: ideas.length });
    }

    // 4. Ideas Main Route (GET/POST/DELETE)
    if (path.endsWith('/ideas')) {
      const { user, error } = await getAuthUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized', details: error });

      if (method === 'GET') {
        const ideas = await kv.getByPrefix(`ideas:${user.uid}:`);
        return res.status(200).json({ ideas: ideas || [] });
      }

      if (method === 'POST') {
        const { idea } = req.body;
        if (!idea || !idea.id) return res.status(400).json({ error: 'Invalid idea data' });
        await kv.set(`ideas:${user.uid}:${idea.id}`, idea);
        return res.status(200).json({ success: true, idea });
      }

      if (method === 'DELETE') {
        const ideas = await kv.getByPrefix(`ideas:${user.uid}:`);
        const keys = ideas.map((idea: any) => `ideas:${user.uid}:${idea.id}`);
        if (keys.length > 0) await kv.mdel(keys);
        return res.status(200).json({ success: true, count: keys.length });
      }
    }

    // 5. Single Idea Route (PUT/DELETE)
    // Matches /api/ideas/:id
    const ideaMatch = path.match(/\/api\/ideas\/([^\/]+)$/);
    if (ideaMatch) {
      const { user, error } = await getAuthUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized', details: error });
      const ideaId = ideaMatch[1];

      if (method === 'PUT') {
        const { idea } = req.body;
        await kv.set(`ideas:${user.uid}:${ideaId}`, idea);
        return res.status(200).json({ success: true, idea });
      }

      if (method === 'DELETE') {
        await kv.del(`ideas:${user.uid}:${ideaId}`);
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: "Not found", path });

  } catch (error: any) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}

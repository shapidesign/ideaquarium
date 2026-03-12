import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { handle } from "hono/vercel";

// ─── Firebase Admin Initialization ───────────────────────────────────────────
function getAdminAuthApp() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAdminAuth();
}

function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
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
  mget: async (keys: string[]): Promise<any[]> => {
    const db = getDb();
    const refs = keys.map(k => db.collection(COLLECTION).doc(encodeKey(k)));
    const snaps = await db.getAll(...refs);
    return snaps.map(snap => (snap.exists ? snap.data()?.value : undefined));
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

// ─── Hono App ────────────────────────────────────────────────────────────────
// Use basePath to match Vercel's rewrite behavior
const app = new Hono().basePath("/api");

// ─── Middleware ───────────────────────────────────────────────────────────────
// Re-enabling middleware now that we are using standard Vercel adapter pattern
app.use('*', logger(console.log));
app.use('*', cors());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (c) => {
  console.log("Health check hit!");
  return c.json({ status: "ok", runtime: "node" });
});

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getAuthUser(c: any) {
  let idToken = c.req.header('X-User-Token');

  if (!idToken) {
    const authHeader = c.req.header('Authorization');
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
    console.log("Auth failed:", err.message);
    return { user: null, error: err.message || "Invalid token" };
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.post("/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const adminAuth = getAdminAuthApp();

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    return c.json({ user: { id: userRecord.uid, email: userRecord.email } });
  } catch (error: any) {
    console.log(`Sign up error: ${error.message}`);
    return c.json({ error: error.message }, 400);
  }
});

app.get("/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const prefix = `ideas:${user.uid}:`;
    console.log(`Fetching ideas for user ${user.uid} with prefix ${prefix}`);

    const ideas = await kv.getByPrefix(prefix);
    console.log(`Found ${ideas.length} ideas`);

    return c.json({ ideas: ideas || [] });
  } catch (error) {
    console.log(`Error getting ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

app.post("/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const { idea } = await c.req.json();
    if (!idea || !idea.id) return c.json({ error: 'Invalid idea data' }, 400);

    const ideaKey = `ideas:${user.uid}:${idea.id}`;
    console.log(`Saving idea: ${ideaKey}`);

    await kv.set(ideaKey, idea);
    return c.json({ success: true, idea });
  } catch (error) {
    console.log(`Error adding idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

app.post("/ideas/batch", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const { ideas } = await c.req.json();
    if (!Array.isArray(ideas)) return c.json({ error: 'Invalid data' }, 400);

    console.log(`Batch uploading ${ideas.length} ideas for user ${user.uid}`);

    if (ideas.length > 0) {
      const keys = ideas.map((idea: any) => `ideas:${user.uid}:${idea.id}`);
      await kv.mset(keys, ideas);
    }

    return c.json({ success: true, count: ideas.length });
  } catch (error) {
    console.log(`Error batch adding ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

app.put("/ideas/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const ideaId = c.req.param('id');
    const { idea } = await c.req.json();

    const ideaKey = `ideas:${user.uid}:${ideaId}`;
    await kv.set(ideaKey, idea);
    return c.json({ success: true, idea });
  } catch (error) {
    console.log(`Error updating idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

app.delete("/ideas/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const ideaId = c.req.param('id');
    await kv.del(`ideas:${user.uid}:${ideaId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

app.delete("/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    console.log(`Clearing all ideas for user ${user.uid}`);

    const ideas = await kv.getByPrefix(`ideas:${user.uid}:`);
    const keys = ideas.map((idea: any) => `ideas:${user.uid}:${idea.id}`);

    if (keys.length > 0) {
      await kv.mdel(keys);
    }

    return c.json({ success: true, count: keys.length });
  } catch (error) {
    console.log(`Error clearing ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Export the handle function for Vercel
export default handle(app);

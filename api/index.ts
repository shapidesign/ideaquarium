import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { handle } from "hono/vercel";
import * as kv from "./lib/kv_store";

// Base path matched in vercel.json rewrite
const app = new Hono();

// ─── Firebase Admin Initialization ───────────────────────────────────────────
function getAdminApp() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAdminAuth();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── Sign up ──────────────────────────────────────────────────────────────────
app.post("/api/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const adminAuth = getAdminApp();

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
    const adminAuth = getAdminApp();
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { user: decoded, error: null };
  } catch (err: any) {
    console.log("Auth failed:", err.message);
    return { user: null, error: err.message || "Invalid token" };
  }
}

// ─── Get user's ideas ─────────────────────────────────────────────────────────
app.get("/api/ideas", async (c) => {
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

// ─── Add new idea ─────────────────────────────────────────────────────────────
app.post("/api/ideas", async (c) => {
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

// ─── Batch upload ideas ───────────────────────────────────────────────────────
app.post("/api/ideas/batch", async (c) => {
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

// ─── Update idea ──────────────────────────────────────────────────────────────
app.put("/api/ideas/:id", async (c) => {
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

// ─── Delete idea ──────────────────────────────────────────────────────────────
app.delete("/api/ideas/:id", async (c) => {
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

// ─── Clear all ideas ──────────────────────────────────────────────────────────
app.delete("/api/ideas", async (c) => {
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

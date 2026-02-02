import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
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

// Health check endpoint
app.get("/make-server-e6b3371a/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-e6b3371a/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true
    });

    if (error) {
      console.log(`Sign up error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Sign up error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper to get authenticated user
async function getAuthUser(c: any) {
  // We prefer X-User-Token to bypass Gateway JWT validation issues
  let accessToken = c.req.header('X-User-Token');
  
  // Fallback to Authorization header if X-User-Token is missing, 
  // but we must be careful: if Authorization contains the Anon Key (which starts with eyJ...),
  // we shouldn't try to use it as a user token. 
  // However, normally for user auth, the client would send 'Bearer <UserToken>'.
  if (!accessToken) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
       accessToken = authHeader.split(' ')[1];
    }
  }

  if (!accessToken) return { user: null, error: "Missing access token" };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    console.log("Auth failed:", error?.message);
    return { user: null, error: error?.message || "Invalid token" };
  }
  return { user, error: null };
}

// Get user's ideas
app.get("/make-server-e6b3371a/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const prefix = `ideas:${user.id}:`;
    console.log(`Fetching ideas for user ${user.id} with prefix ${prefix}`);
    
    const ideas = await kv.getByPrefix(prefix);
    console.log(`Found ${ideas.length} ideas`);
    
    return c.json({ ideas: ideas || [] });
  } catch (error) {
    console.log(`Error getting ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Add new idea
app.post("/make-server-e6b3371a/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const { idea } = await c.req.json();
    if (!idea || !idea.id) return c.json({ error: 'Invalid idea data' }, 400);

    const ideaKey = `ideas:${user.id}:${idea.id}`;
    console.log(`Saving idea: ${ideaKey}`);
    
    await kv.set(ideaKey, idea);
    return c.json({ success: true, idea });
  } catch (error) {
    console.log(`Error adding idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Sync multiple ideas (Batch Upload)
app.post("/make-server-e6b3371a/ideas/batch", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const { ideas } = await c.req.json();
    if (!Array.isArray(ideas)) return c.json({ error: 'Invalid data' }, 400);

    console.log(`Batch uploading ${ideas.length} ideas for user ${user.id}`);

    if (ideas.length > 0) {
      const keys = ideas.map((idea: any) => `ideas:${user.id}:${idea.id}`);
      await kv.mset(keys, ideas);
    }
    
    return c.json({ success: true, count: ideas.length });
  } catch (error) {
    console.log(`Error batch adding ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Update idea
app.put("/make-server-e6b3371a/ideas/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const ideaId = c.req.param('id');
    const { idea } = await c.req.json();
    
    if (idea.id !== ideaId) {
       // Ideally these should match, but we trust the body
    }

    const ideaKey = `ideas:${user.id}:${ideaId}`;
    await kv.set(ideaKey, idea);
    return c.json({ success: true, idea });
  } catch (error) {
    console.log(`Error updating idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete idea
app.delete("/make-server-e6b3371a/ideas/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    const ideaId = c.req.param('id');
    const ideaKey = `ideas:${user.id}:${ideaId}`;
    
    await kv.del(ideaKey);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting idea: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Clear all ideas
app.delete("/make-server-e6b3371a/ideas", async (c) => {
  try {
    const { user, error } = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized', details: error }, 401);

    console.log(`Clearing all ideas for user ${user.id}`);
    
    // Get all keys first
    const ideas = await kv.getByPrefix(`ideas:${user.id}:`);
    const keys = ideas.map((idea: any) => `ideas:${user.id}:${idea.id}`);
    
    if (keys.length > 0) {
      await kv.mdel(keys);
    }
    
    return c.json({ success: true, count: keys.length });
  } catch (error) {
    console.log(`Error clearing ideas: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
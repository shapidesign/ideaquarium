import { useState, useEffect, useCallback } from "react";
import { User, LogOut, RefreshCw, Heart } from "lucide-react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/utils/firebase/client";

import { SwimmingFish } from "@/app/components/SwimmingFish";
import { IdeaModal } from "@/app/components/IdeaModal";
import { IdeaDetailModal } from "@/app/components/IdeaDetailModal";
import { IdeasListModal } from "@/app/components/IdeasListModal";
import { AuthModal } from "@/app/components/AuthModal";
import { FISH_ASSETS } from "@/app/utils/fishAssets";
import { Button } from "@/components/ui/Button";

export interface Idea {
  id: string;
  name: string;
  description: string;
  fishImage?: string; // Legacy support
  fishType?: number; // New support: index into FISH_ASSETS
  isDone?: boolean; // Status: true if completed
}

const ANON_STORAGE_KEY = "aquarium-ideas-anon";
const getStorageKey = (uid?: string) => uid ? `aquarium-ideas-${uid}` : ANON_STORAGE_KEY;

// ─── Server URL ──────────────────────────────────────────────────────────────
// Vercel Serverless Function endpoint (mapped via vercel.json)
const SERVER_URL = "/api";
// ─────────────────────────────────────────────────────────────────────────────

/** Get a fresh Firebase ID token for the current user, or null if not logged in. */
async function getToken(forceRefresh = false): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

function App() {
  // Set favicon on mount
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='16'>🐠</text></svg>";
    document.getElementsByTagName('head')[0].appendChild(link);
    document.title = '🐠 אקווריום רעיונות';
  }, []);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [nextId, setNextId] = useState(1);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Auth & Sync State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load ideas from localStorage on mount
  useEffect(() => {
    try {
      // Check for user-specific vs anon vs legacy
      const userKey = getStorageKey(auth.currentUser?.uid);
      let stored = localStorage.getItem(userKey);
      
      // Legacy fallback (convert "aquarium-ideas" to "aquarium-ideas-anon" if needed)
      if (!stored && !auth.currentUser) {
        const legacy = localStorage.getItem("aquarium-ideas");
        if (legacy) {
          stored = legacy;
          localStorage.setItem(ANON_STORAGE_KEY, legacy);
          localStorage.removeItem("aquarium-ideas");
        }
      }

      if (stored) {
        const parsedIdeas = JSON.parse(stored);
        setIdeas(prev => prev.length === 0 ? parsedIdeas : prev);
        if (parsedIdeas.length > 0) {
          const maxId = Math.max(...parsedIdeas.map((idea: Idea) => {
            const num = parseInt(idea.id);
            return isNaN(num) ? 0 : num;
          }));
          setNextId(maxId + 1);
        }
      }
    } catch (error) {
      console.error("Error loading ideas from localStorage:", error);
    }
  }, []);

  const batchUploadIdeas = async (ideasToUpload: Idea[], token: string) => {
    const res = await fetch(`${SERVER_URL}/ideas/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': token,
      },
      body: JSON.stringify({ ideas: ideasToUpload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Upload failed");
    }
  };

  const handleSignOut = async () => {
    // Clear state immediately
    setUser(null);
    setIdeas([]);
    setNextId(1);
    setIsSyncing(false);

    try {
      await firebaseSignOut(auth);
      // After sign out, reload anonymous ideas
      const stored = localStorage.getItem(ANON_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setIdeas(parsed);
        if (parsed.length > 0) {
          const maxId = Math.max(...parsed.map((i: Idea) => {
            const num = parseInt(i.id);
            return isNaN(num) ? 0 : num;
          }));
          setNextId(maxId + 1);
        }
      }
    } catch (e) {
      console.warn("Sign out failed:", e);
    }
  };

  const fetchServerIdeas = useCallback(async (silent = false, overrideToken?: string) => {
    if (!silent) setIsSyncing(true);
    try {
      let token = overrideToken ?? await getToken();
      if (!token) {
        if (!silent) setIsSyncing(false);
        return;
      }

      const res = await fetch(`${SERVER_URL}/ideas?t=${Date.now()}`, {
        headers: { 'X-User-Token': token },
        cache: 'no-store',
      });

      if (res.status === 401) {
        // Try refreshing the token once
        const freshToken = await getToken(true);
        if (freshToken) {
          await fetchServerIdeas(silent, freshToken);
        } else {
          await handleSignOut();
        }
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const serverIdeas: Idea[] = data.ideas || [];

        setIdeas(currentIdeas => {
          // If we are migrating anonymous ideas, merge them.
          // Otherwise, the server is the source of truth for a logged-in user.
          // IMPORTANT: We only want to auto-upload "missing" ideas if they weren't
          // just fetched from another device.
          
          // Logic: If currentIdeas has things not on server, upload them.
          // But we must be careful NOT to upload User A's ideas to User B's account.
          // This is now handled by clearing state on logout and using unique keys.
          const missingOnServer = currentIdeas.filter(
            local => !serverIdeas.some(s => s.id === local.id)
          );

          if (missingOnServer.length > 0) {
            batchUploadIdeas(missingOnServer, token!).catch(e =>
              console.error("Auto-upload failed:", e)
            );
          }

          const mergedIdeas = [...serverIdeas, ...missingOnServer];
          localStorage.setItem(getStorageKey(auth.currentUser?.uid), JSON.stringify(mergedIdeas));
          
          if (mergedIdeas.length > 0) {
            const maxId = mergedIdeas.reduce((max: number, idea: Idea) => {
              const numId = parseInt(idea.id);
              return !isNaN(numId) && numId > max ? numId : max;
            }, 0);
            setNextId(maxId + 1);
          }
          return mergedIdeas;
        });
      }
    } catch (err) {
      console.error("Error fetching server ideas:", err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  const handleManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active session");
      if (ideas.length > 0) await batchUploadIdeas(ideas, token);
      await fetchServerIdeas(true);
    } catch (err) {
      console.error("Manual sync failed:", err);
      alert("שגיאה בסנכרון. נסה שוב.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User logged in
        setUser(firebaseUser);
        
        // 1. Check for anonymous ideas to migrate
        const anonData = localStorage.getItem(ANON_STORAGE_KEY);
        if (anonData) {
          try {
            const anonIdeas = JSON.parse(anonData);
            if (anonIdeas.length > 0) {
              setIdeas(anonIdeas); // Temporarily show them while fetching/uploading
              // Migration will happen inside fetchServerIdeas -> setIdeas callback
            }
          } catch (e) {
            console.error("Anon migration parse error", e);
          }
          // Clear anon storage so we don't migrate again
          localStorage.removeItem(ANON_STORAGE_KEY);
        } else {
          // If no anon data, clear state to prevent leakage from previous user
          // (though handled by handlesignout too)
          setIdeas([]);
        }

        const token = await firebaseUser.getIdToken();
        fetchServerIdeas(false, token);
      } else {
        // User logged out - handled by handleSignOut usually, but as fallback:
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [fetchServerIdeas]);

  // Poll silently every 10 seconds when logged in
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => fetchServerIdeas(true), 10000);
    return () => clearInterval(intervalId);
  }, [user, fetchServerIdeas]);

  // Persist ideas to localStorage on every change
  useEffect(() => {
    try {
      const currentKey = getStorageKey(user?.uid);
      localStorage.setItem(currentKey, JSON.stringify(ideas));
    } catch (error) {
      console.error("Error saving ideas to localStorage:", error);
    }
  }, [ideas, user]);

  const handleAuthSuccess = (_token: string) => {
    setIsAuthModalOpen(false);
  };

  const handleAddIdea = async (name: string, description: string, isDone: boolean) => {
    const randomFishType = Math.floor(Math.random() * FISH_ASSETS.length);
    const newId = user ? `${Date.now()}` : nextId.toString();

    const newIdea: Idea = { id: newId, name, description, fishType: randomFishType, isDone };
    const updatedIdeas = [...ideas, newIdea];
    setIdeas(updatedIdeas);
    setNextId(prev => prev + 1);

    if (user) {
      try {
        const token = await getToken();
        if (token) {
          await fetch(`${SERVER_URL}/ideas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Token': token },
            body: JSON.stringify({ idea: newIdea }),
          });
        }
      } catch (err) {
        console.error("Failed to sync add to server", err);
      }
    }
  };

  const handleFishClick = (idea: Idea) => setSelectedIdea(idea);

  const handleEditIdea = (idea: Idea) => {
    setEditingIdea(idea);
    setSelectedIdea(null);
  };

  const handleUpdateIdea = async (name: string, description: string, isDone: boolean) => {
    if (!editingIdea) return;
    const updatedIdea: Idea = { ...editingIdea, name, description, isDone };
    setIdeas(ideas.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea));
    setEditingIdea(null);

    if (user) {
      try {
        const token = await getToken();
        if (token) {
          await fetch(`${SERVER_URL}/ideas/${updatedIdea.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-User-Token': token },
            body: JSON.stringify({ idea: updatedIdea }),
          });
        }
      } catch (err) {
        console.error("Failed to sync update to server", err);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm("האם אתה בטוח שברצונך למחוק את כל הרעיונות?")) {
      setIdeas([]);
      setNextId(1);
      localStorage.removeItem(getStorageKey(user?.uid));

      if (user) {
        try {
          const token = await getToken();
          if (token) {
            await fetch(`${SERVER_URL}/ideas`, {
              method: 'DELETE',
              headers: { 'X-User-Token': token },
            });
          }
        } catch (err) {
          console.error("Failed to sync delete all to server", err);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden" dir="rtl">

      {/* Top Left: Support Button (Heart Icon) */}
      <div className="absolute top-6 left-6 md:top-8 md:left-8 z-30">
        <Button
          variant="primary"
          onClick={() => window.open("https://www.buymeacoffee.com/shapi", "_blank")}
          title="Support My Work"
          className="bg-[#5F7FFF] hover:bg-[#4a63cc] flex items-center gap-2 px-3 pl-3 pr-2"
        >
          <span className="hidden md:inline font-hebrew text-white text-sm">תמכו בי</span>
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
        </Button>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8 z-30 flex items-start gap-4">
        {/* Auth Button */}
        <Button
          variant={user ? "ghost" : "secondary"}
          size="icon"
          onClick={() => user ? handleSignOut() : setIsAuthModalOpen(true)}
          title={user ? "התנתק" : "התחבר"}
          className={user ? "bg-[#FFE5B4]" : "bg-brand-orange"}
        >
          {user ? <LogOut className="w-6 h-6" /> : <User className="w-6 h-6" />}
        </Button>

        {/* Manual Sync Button */}
        {user && (
          <Button
            variant="primary"
            size="icon"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="סנכרן כעת"
            className="bg-brand-blue"
          >
            <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        )}

        {/* Clear All Button */}
        {ideas.length > 0 && (
          <Button
            variant="danger"
            onClick={handleClearAll}
            className="px-4 py-2 h-12 text-xs md:text-sm font-hebrew"
          >
            מחק הכל
          </Button>
        )}
      </div>

      {/* Sync Indicator */}
      {isSyncing && !user && (
        <div className="absolute top-24 right-6 md:top-28 md:right-8 z-20 flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full border-2 border-black">
          <RefreshCw className="w-4 h-4 animate-spin text-[#332085]" />
          <span className="text-xs font-hebrew">מסנכרן...</span>
        </div>
      )}

      {/* Bottom Center: New Idea Button */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 md:bottom-8 z-30 pointer-events-auto">
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          className="h-16 px-8 py-4 text-xl md:text-3xl font-hebrew font-bold bg-brand-blue hover:bg-brand-blue/90"
        >
          רעיון חדש
        </Button>
      </div>

      {/* Bottom Left: Idea Count */}
      {ideas.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0 md:bottom-8 z-30 pointer-events-auto">
          <Button
            variant="ghost"
            onClick={() => setIsListModalOpen(true)}
            className="bg-white hover:bg-gray-100 flex items-center gap-3"
          >
            <span className="text-lg md:text-2xl font-hebrew font-bold text-blue-800 leading-none">
              {ideas.length}
            </span>
            <span className="text-sm md:text-lg font-hebrew font-bold text-black leading-none">
              רעיונות
            </span>
          </Button>
        </div>
      )}

      {/* Swimming Fish */}
      {ideas.map((idea) => (
        <SwimmingFish
          key={idea.id}
          idea={idea}
          totalIdeas={ideas.length}
          onFishClick={handleFishClick}
        />
      ))}

      {/* Modals */}
      <IdeaModal
        isOpen={isModalOpen || !!editingIdea}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIdea(null);
        }}
        onAddIdea={editingIdea ? handleUpdateIdea : handleAddIdea}
        editIdea={editingIdea}
      />

      <IdeaDetailModal
        idea={selectedIdea}
        onClose={() => setSelectedIdea(null)}
        onEditIdea={handleEditIdea}
      />

      <IdeasListModal
        ideas={ideas}
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onIdeaClick={handleFishClick}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
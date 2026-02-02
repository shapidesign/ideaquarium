import { useState, useEffect, useCallback } from "react";
import { User, LogOut, RefreshCw, Heart } from "lucide-react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { projectId, publicAnonKey } from "@/utils/supabase/info";

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

const STORAGE_KEY = "aquarium-ideas";
const SUPABASE_URL = `https://${projectId}.supabase.co`;
const SERVER_URL = `${SUPABASE_URL}/functions/v1/make-server-e6b3371a`;

// Initialize Supabase client
const supabase = getSupabaseClient();

function App() {
  // Set favicon on mount
  useEffect(() => {
    // Basic favicon setup
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='16'>🐠</text></svg>";
    document.getElementsByTagName('head')[0].appendChild(link);

    // Set page title
    document.title = '🐠 אקווריום רעיונות';
  }, []);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [nextId, setNextId] = useState(1);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Auth & Sync State
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load ideas from localStorage on mount (initial load)
  useEffect(() => {
    try {
      const storedIdeas = localStorage.getItem(STORAGE_KEY);
      if (storedIdeas) {
        const parsedIdeas = JSON.parse(storedIdeas);
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
    try {
      const res = await fetch(`${SERVER_URL}/ideas/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': token
        },
        body: JSON.stringify({ ideas: ideasToUpload })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
    } catch (err) {
      console.error("Error batch uploading:", err);
      throw err;
    }
  };

  const handleSignOut = async () => {
    setUser(null);
    setIsSyncing(false);

    const storedIdeas = localStorage.getItem(STORAGE_KEY);
    if (storedIdeas) {
      setIdeas(JSON.parse(storedIdeas));
    }

    try {
      await supabase.auth.signOut();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`sb-${projectId}`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Sign out cleanup failed (ignorable):", e);
    }
  };

  // Sync with server
  const fetchServerIdeas = useCallback(async (silent = false, isRetry = false, overrideToken?: string) => {
    if (!silent) setIsSyncing(true);
    try {
      let token = overrideToken;

      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!silent) setIsSyncing(false);
          return;
        }
        token = session.access_token;
      }

      if (!token) return;

      const res = await fetch(`${SERVER_URL}/ideas?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': token
        },
        cache: 'no-store'
      });

      if (res.status === 401) {
        if (!isRetry) {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            await fetchServerIdeas(silent, true, data.session.access_token);
            return;
          } else {
            await handleSignOut();
            return;
          }
        } else {
          await handleSignOut();
          return;
        }
      }

      if (res.ok) {
        const data = await res.json();
        const serverIdeas = data.ideas || [];

        setIdeas(currentLocalIdeas => {
          const missingOnServer = currentLocalIdeas.filter(
            localIdea => !serverIdeas.some((serverIdea: Idea) => serverIdea.id === localIdea.id)
          );

          if (missingOnServer.length > 0) {
            batchUploadIdeas(missingOnServer, token!).catch(e => console.error("Auto-upload failed:", e));
          }

          const mergedIdeas = [...serverIdeas, ...missingOnServer];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedIdeas));

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No active session");
      const token = session.access_token;

      if (ideas.length > 0) {
        await batchUploadIdeas(ideas, token);
      }

      await fetchServerIdeas(true);
    } catch (err) {
      console.error("Manual sync failed:", err);
      alert("שגיאה בסנכרון. נסה שוב.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchServerIdeas(false, false, session.access_token);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
          fetchServerIdeas(false, false, session.access_token);
        }
      } else {
        setUser(null);
        const storedIdeas = localStorage.getItem(STORAGE_KEY);
        if (storedIdeas) {
          setIdeas(JSON.parse(storedIdeas));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchServerIdeas]);

  useEffect(() => {
    if (!user) return; // Poll only if logged in

    const intervalId = setInterval(() => {
      fetchServerIdeas(true); // true = silent (no spinner)
    }, 10000);

    return () => clearInterval(intervalId);
  }, [user, fetchServerIdeas]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
    } catch (error) {
      console.error("Error saving ideas to localStorage:", error);
    }
  }, [ideas]);

  const handleAuthSuccess = (_token: string) => {
    setIsAuthModalOpen(false);
  };

  const handleAddIdea = async (name: string, description: string, isDone: boolean) => {
    const randomFishType = Math.floor(Math.random() * FISH_ASSETS.length);
    const newId = user ? `${Date.now()}` : nextId.toString();

    const newIdea: Idea = {
      id: newId,
      name,
      description,
      fishType: randomFishType,
      isDone,
    };

    const updatedIdeas = [...ideas, newIdea];
    setIdeas(updatedIdeas);
    setNextId(prev => prev + 1);

    if (user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${SERVER_URL}/ideas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-User-Token': session.access_token
            },
            body: JSON.stringify({ idea: newIdea })
          });
        }
      } catch (err) {
        console.error("Failed to sync add to server", err);
      }
    }
  };

  const handleFishClick = (idea: Idea) => {
    setSelectedIdea(idea);
  };

  const handleEditIdea = (idea: Idea) => {
    setEditingIdea(idea);
    setSelectedIdea(null);
  };

  const handleUpdateIdea = async (name: string, description: string, isDone: boolean) => {
    if (!editingIdea) return;

    const updatedIdea: Idea = {
      ...editingIdea,
      name,
      description,
      isDone,
    };

    setIdeas(ideas.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea));
    setEditingIdea(null);

    if (user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${SERVER_URL}/ideas/${updatedIdea.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-User-Token': session.access_token
            },
            body: JSON.stringify({ idea: updatedIdea })
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
      localStorage.removeItem(STORAGE_KEY);

      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch(`${SERVER_URL}/ideas`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'X-User-Token': session.access_token
              }
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

      {/* Swimming Fish - Keeping Legacy Component for now, assuming it handles rendering fine */}
      {ideas.map((idea) => (
        <SwimmingFish
          key={idea.id}
          idea={idea}
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
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { auth } from "@/utils/firebase/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (accessToken: string) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      const token = await user.getIdToken();
      onAuthSuccess(token);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError("שגיאה בהתחברות עם גוגל");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Create new account with Firebase Auth
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Optionally set the display name
        if (name) {
          await updateProfile(user, { displayName: name });
        }

        const token = await user.getIdToken();
        onAuthSuccess(token);

        // Clear form
        setEmail("");
        setPassword("");
        setName("");
      } else {
        // Sign in with Firebase Auth
        const { user } = await signInWithEmailAndPassword(auth, email, password);

        const token = await user.getIdToken();
        onAuthSuccess(token);

        // Clear form
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      console.error("Auth error:", err);

      // User-friendly error messages in Hebrew
      let errorMessage = "שגיאה בהתחברות";

      const code = err.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        errorMessage = "אימייל או סיסמה שגויים";
      } else if (code === "auth/email-already-in-use") {
        errorMessage = "משתמש כבר קיים במערכת";
      } else if (code === "auth/weak-password") {
        errorMessage = "הסיסמה חלשה מדי (לפחות 6 תווים)";
      } else if (code === "auth/invalid-email") {
        errorMessage = "כתובת אימייל לא תקינה";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSignUp ? "הרשמה" : "כניסה"}
      className="bg-[#F5F5DC]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" dir="rtl">
        {isSignUp && (
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם"
            required
            className="text-right"
          />
        )}

        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="אימייל"
          required
          dir="ltr"
          className="text-left font-pixel text-xs"
        />

        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          required
          minLength={6}
          className="text-right"
        />

        {error && (
          <p className="text-red-600 text-sm font-pixel text-center leading-relaxed">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          variant="secondary"
          className="w-full text-lg mt-2"
        >
          {loading ? "טוען..." : isSignUp ? "הרשמה" : "כניסה"}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#F5F5DC] px-2 text-gray-500 font-hebrew text-base">או</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          variant="outline"
          className="w-full text-lg flex items-center justify-center gap-2 font-hebrew border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          התחבר עם גוגל
        </Button>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="text-sm font-hebrew text-blue-800 hover:underline text-center mt-2 relative z-10"
        >
          {isSignUp
            ? "יש לך חשבון? התחבר"
            : "אין לך חשבון? הירשם"}
        </button>
      </form>
    </Modal>
  );
}

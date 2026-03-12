import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
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

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="text-sm font-hebrew text-blue-800 hover:underline text-center mt-2"
        >
          {isSignUp
            ? "יש לך חשבון? התחבר"
            : "אין לך חשבון? הירשם"}
        </button>
      </form>
    </Modal>
  );
}

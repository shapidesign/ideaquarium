import { useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { projectId, publicAnonKey } from "@/utils/supabase/info";
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
      const supabase = getSupabaseClient();

      if (isSignUp) {
        // Sign up via server
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e6b3371a/signup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ email, password, name }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Sign up failed");
        }

        // Now sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (!signInData?.session?.access_token) {
          throw new Error("No access token received");
        }

        onAuthSuccess(signInData.session.access_token);

        // Clear form
        setEmail("");
        setPassword("");
        setName("");
      } else {
        // Sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (!signInData?.session?.access_token) {
          throw new Error("No access token received");
        }

        onAuthSuccess(signInData.session.access_token);

        // Clear form
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      console.error("Auth error:", err);

      // User-friendly error messages in Hebrew
      let errorMessage = "שגיאה בהתחברות";

      if (err.message?.includes("Invalid login credentials")) {
        errorMessage = "אימייל או סיסמה שגויים";
      } else if (err.message?.includes("Email not confirmed")) {
        errorMessage = "יש לאשר את כתובת האימייל";
      } else if (err.message?.includes("User already registered")) {
        errorMessage = "משתמש כבר קיים במערכת";
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
          variant="secondary" // Orange as per Figma for auth
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

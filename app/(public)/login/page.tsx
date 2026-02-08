"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import { getProfileForAuthUser } from "../../../lib/profile";
import { validateSession } from "../../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const checkExisting = async () => {
      const { user } = await validateSession();
      if (!user) return;
      const profile = await getProfileForAuthUser(user.id);
      if (!profile) {
        router.replace("/claim");
        return;
      }
      router.replace("/inbox");
    };
    void checkExisting();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { user, error: sessionError } = await validateSession();
    if (sessionError) {
      setError("Session expired, please sign in again.");
      setLoading(false);
      return;
    }

    if (!user) {
      setError("Unable to load session.");
      setLoading(false);
      return;
    }

    const profile = await getProfileForAuthUser(user.id);
    if (!profile) {
      router.replace("/claim");
      return;
    }

    router.replace("/inbox");
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Welcome back</h1>
        <p className="notice">Sign in with the email on your account.</p>
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

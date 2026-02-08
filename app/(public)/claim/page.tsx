"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSession } from "../../../lib/session";
import { getProfileForAuthUser } from "../../../lib/profile";

type ClaimRole = "student" | "parent" | "teacher";

type ClaimResponse = {
  success?: boolean;
  generated_email?: string;
  message?: string;
};

export default function ClaimPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [role, setRole] = useState<ClaimRole>("student");
  const [schoolCode, setSchoolCode] = useState("");
  const [externalId, setExternalId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const check = async () => {
      const { user } = await validateSession();
      if (!user) {
        router.replace("/login");
        return;
      }

      const profile = await getProfileForAuthUser(user.id);
      if (profile) {
        router.replace("/inbox");
      }
    };
    void check();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);

    const endpoint = `/api/claim/${role}`;
    const payload =
      role === "student"
        ? { school_code: schoolCode, external_id: externalId, password }
        : { school_code: schoolCode, email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as ClaimResponse;

    if (!response.ok) {
      setError(data.message ?? "Unable to claim account.");
      setLoading(false);
      return;
    }

    if (data.generated_email) {
      setStatus(
        `Account claimed! Use ${data.generated_email} with your password to sign in.`
      );
    } else {
      setStatus("Account claimed! Please sign in.");
    }

    setLoading(false);
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Claim your account</h1>
        <p className="notice">
          Use your school code and profile details to link your account.
        </p>
        {status ? <div className="notice">{status}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as ClaimRole)}
            >
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="schoolCode">School code</label>
            <input
              id="schoolCode"
              value={schoolCode}
              onChange={(event) => setSchoolCode(event.target.value)}
              required
            />
          </div>
          {role === "student" ? (
            <div className="field">
              <label htmlFor="externalId">Student ID</label>
              <input
                id="externalId"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                required
              />
            </div>
          ) : (
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
          )}
          <div className="field">
            <label htmlFor="password">Create a password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Claiming..." : "Claim account"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSession } from "../../../lib/session";

export default function EventsPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const load = async () => {
      const { user } = await validateSession();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
    };
    void load();
  }, [router]);

  return (
    <div className="container">
      <div className="card">
        <h1>Events</h1>
        <p>Authenticated user id: {userId ?? "..."}</p>
      </div>
    </div>
  );
}

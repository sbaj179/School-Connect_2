"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import { getProfileForAuthUser, Profile } from "../../../lib/profile";
import { validateSession } from "../../../lib/session";

type Group = {
  id: string;
  subject: string;
  student_external_id: string | null;
  created_at: string;
};

type MessagePreview = {
  id: string;
  group_id: string;
  text: string;
  created_at: string;
};

type InboxRow = {
  group: Group;
  latestMessage?: MessagePreview;
};

export default function InboxPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const load = async () => {
      const { user } = await validateSession();
      if (!user) {
        router.replace("/login");
        return;
      }

      const userProfile = await getProfileForAuthUser(user.id);
      if (!userProfile) {
        router.replace("/claim");
        return;
      }

      setProfile(userProfile);

      const { data: memberships, error: membershipError } = await supabaseBrowser
        .from("group_members")
        .select("group_id")
        .eq("user_id", userProfile.id);

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      const groupIds = memberships?.map((member) => member.group_id) ?? [];
      if (groupIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: groups, error: groupsError } = await supabaseBrowser
        .from("groups")
        .select("id, subject, student_external_id, created_at")
        .in("id", groupIds);

      if (groupsError) {
        setError(groupsError.message);
        setLoading(false);
        return;
      }

      const { data: messages, error: messagesError } = await supabaseBrowser
        .from("messages")
        .select("id, group_id, text:body, created_at")
        .eq("is_deleted", false)
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (messagesError) {
        setError(messagesError.message);
        setLoading(false);
        return;
      }

      const latestMap = new Map<string, MessagePreview>();
      messages?.forEach((message) => {
        if (!latestMap.has(message.group_id)) {
          latestMap.set(message.group_id, message as MessagePreview);
        }
      });

      const combinedRows = (groups ?? []).map((group) => ({
        group: group as Group,
        latestMessage: latestMap.get(group.id)
      }));

      setRows(combinedRows);
      setLoading(false);
    };

    void load();
  }, [router]);

  return (
    <div className="container">
      <div className="card">
        <div className="chat-header">
          <div>
            <h1>Inbox</h1>
            <p className="notice">Signed in as {profile?.name ?? "..."}</p>
          </div>
          <button
            className="secondary"
            onClick={() => router.push("/events")}
          >
            Events
          </button>
        </div>
        {loading ? <p>Loading inbox...</p> : null}
        {error ? <div className="error">{error}</div> : null}
        {!loading && rows.length === 0 ? (
          <p>No message threads yet.</p>
        ) : null}
        <div className="grid">
          {rows.map((row) => (
            <div
              key={row.group.id}
              className="card"
              style={{ cursor: "pointer" }}
              onClick={() => router.push(`/groups/${row.group.id}`)}
            >
              <h3>{row.group.subject}</h3>
              {row.group.student_external_id ? (
                <p className="notice">
                  Student: {row.group.student_external_id}
                </p>
              ) : null}
              <p>
                {row.latestMessage
                  ? row.latestMessage.text
                  : "No messages yet."}
              </p>
              {row.latestMessage ? (
                <small>{new Date(row.latestMessage.created_at).toLocaleString()}</small>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

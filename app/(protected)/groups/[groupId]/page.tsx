"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../lib/supabase-browser";
import { getProfileForAuthUser, Profile } from "../../../../lib/profile";
import { validateSession } from "../../../../lib/session";

type Group = {
  id: string;
  subject: string;
  student_external_id: string | null;
  created_at: string;
};

type Message = {
  id: string;
  group_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

type SenderMap = Record<string, string>;

export default function GroupPage({ params }: { params: { groupId: string } }) {
  const router = useRouter();
  const ranRef = useRef(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderMap, setSenderMap] = useState<SenderMap>({});
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const groupId = params.groupId;

  const messageIds = useMemo(() => new Set(messages.map((msg) => msg.id)), [
    messages
  ]);

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

      const { data: membership, error: membershipError } = await supabaseBrowser
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userProfile.id)
        .maybeSingle();

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      if (!membership) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const { data: groupData, error: groupError } = await supabaseBrowser
        .from("groups")
        .select("id, subject, student_external_id, created_at")
        .eq("id", groupId)
        .single();

      if (groupError) {
        setError(groupError.message);
        setLoading(false);
        return;
      }

      setGroup(groupData as Group);

      const { data: messageData, error: messageError } = await supabaseBrowser
        .from("messages")
        .select("id, group_id, sender_user_id, body, created_at")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (messageError) {
        setError(messageError.message);
        setLoading(false);
        return;
      }

      const senders = Array.from(
        new Set((messageData ?? []).map((msg) => msg.sender_user_id))
      );

      let senderMapping: SenderMap = {};

      if (senders.length > 0) {
        const { data: senderRows } = await supabaseBrowser
          .from("users")
          .select("id, name")
          .in("id", senders);

        senderMapping = (senderRows ?? []).reduce<SenderMap>((acc, row) => {
          acc[row.id] = row.name;
          return acc;
        }, {});
      }

      setSenderMap(senderMapping);
      setMessages(messageData as Message[]);
      setLoading(false);
    };

    void load();
  }, [groupId, router]);

  useEffect(() => {
    const channel = supabaseBrowser.channel(`messages:${groupId}`);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
      (payload) => {
        const newMessage = payload.new as Message;
        if (messageIds.has(newMessage.id)) return;
        setMessages((prev) => [...prev, newMessage]);
        if (!senderMap[newMessage.sender_user_id]) {
          void supabaseBrowser
            .from("users")
            .select("id, name")
            .eq("id", newMessage.sender_user_id)
            .single()
            .then(({ data }) => {
              if (data) {
                setSenderMap((prev) => ({ ...prev, [data.id]: data.name }));
              }
            });
        }
      }
    );

    void channel.subscribe();

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [groupId, messageIds, senderMap]);

  const handleSend = async () => {
    if (!composer.trim() || !profile) return;
    const body = composer.trim();
    setComposer("");

    const { error: insertError } = await supabaseBrowser.from("messages").insert({
      group_id: groupId,
      sender_user_id: profile.id,
      body,
      school_id: profile.school_id
    });

    if (insertError) {
      setError(insertError.message);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="chat-header">
          <div>
            <h1>{group ? group.subject : "Group"}</h1>
            {group?.student_external_id ? (
              <p className="notice">Student: {group.student_external_id}</p>
            ) : null}
          </div>
          <button className="secondary" onClick={() => router.push("/inbox")}
          >
            Back to inbox
          </button>
        </div>
        {loading ? <p>Loading messages...</p> : null}
        {error ? <div className="error">{error}</div> : null}
        <div className="chat-shell">
          <div className="message-list">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-bubble${
                  message.sender_user_id === profile?.id ? " self" : ""
                }`}
              >
                <small>
                  {senderMap[message.sender_user_id] ?? "Unknown"}
                </small>
                <div>{message.body}</div>
                <small>{new Date(message.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
          <div className="chat-composer">
            <textarea
              rows={2}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Type a message"
            />
            <button type="button" onClick={handleSend}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

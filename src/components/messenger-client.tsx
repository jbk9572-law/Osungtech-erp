"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, deleteMessage } from "@/app/(dashboard)/messenger/actions";

type Message = {
  id: string;
  sender_id: string | null;
  content: string;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

export function MessengerClient({
  initialMessages,
  profileNames,
  currentUserId,
}: {
  initialMessages: Message[];
  profileNames: Record<string, string>;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState(sendMessage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("messenger_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messenger_messages" },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messenger_messages" },
        (payload) => {
          const row = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  function nameFor(senderId: string | null) {
    if (!senderId) return "알 수 없음";
    return profileNames[senderId] ?? "구성원";
  }

  return (
    <div
      className="erp-detail"
      style={{ marginTop: 0, display: "flex", flexDirection: "column", height: "70vh" }}
    >
      <div className="erp-detail-tabs">
        <span className="erp-detail-tab active">전체 대화방</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "70%" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--erp-text-muted)",
                  marginBottom: 2,
                  textAlign: mine ? "right" : "left",
                }}
              >
                {nameFor(m.sender_id)} · {new Date(m.created_at).toLocaleString("ko-KR")}
              </div>
              <div
                style={{
                  background: mine ? "var(--erp-primary)" : "#f0f2f5",
                  color: mine ? "#fff" : "var(--erp-text)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.content}
                {m.file_url && (
                  <div style={{ marginTop: m.content ? 6 : 0 }}>
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: mine ? "#fff" : "var(--erp-primary)",
                        textDecoration: "underline",
                        fontSize: 12,
                      }}
                    >
                      📎 {m.file_name}
                      {m.file_size ? ` (${Math.round(m.file_size / 1024)}KB)` : ""}
                    </a>
                  </div>
                )}
              </div>
              {mine && (
                <form action={deleteMessage} style={{ textAlign: "right" }}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="file_path" value={m.file_path ?? ""} />
                  <button
                    type="submit"
                    style={{
                      fontSize: 10,
                      color: "var(--erp-text-muted)",
                      background: "none",
                      border: "none",
                      padding: "2px 0",
                    }}
                  >
                    삭제
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {!messages.length && (
          <p className="erp-grid-empty">아직 메시지가 없습니다. 첫 메시지를 남겨보세요.</p>
        )}
        <div ref={listEndRef} />
      </div>

      <form
        ref={formRef}
        action={formAction}
        style={{
          borderTop: "1px solid var(--erp-border)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          padding: 12,
        }}
      >
        <textarea
          name="content"
          placeholder="메시지를 입력하세요"
          rows={2}
          className="erp-input"
          style={{ flex: 1, resize: "vertical" }}
        />
        <input type="file" name="file" style={{ maxWidth: 160, fontSize: 12 }} />
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 전송 중...
            </>
          ) : (
            "전송"
          )}
        </button>
      </form>
      {state?.error && (
        <p style={{ padding: "0 12px 12px", color: "var(--erp-danger)", fontSize: 12 }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

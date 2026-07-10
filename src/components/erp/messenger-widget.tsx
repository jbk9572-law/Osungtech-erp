"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, deleteMessage } from "@/app/(dashboard)/messenger/actions";

export type MessengerMessage = {
  id: string;
  sender_id: string | null;
  content: string;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

// 좌측 메뉴 대신 우측 하단에 떠 있는 사내메신저 위젯. 평소엔 동그란 버튼으로
// 최소화돼 있다가 클릭하면 채팅창으로 펼쳐진다.
export function MessengerWidget({
  initialMessages,
  profileNames,
  currentUserId,
}: {
  initialMessages: MessengerMessage[];
  profileNames: Record<string, string>;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState(sendMessage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("messenger_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messenger_messages" },
        (payload) => {
          const row = payload.new as MessengerMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (!openRef.current && row.sender_id !== currentUserId) {
            setHasUnseen(true);
          }
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
  }, [currentUserId]);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView();
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  function nameFor(senderId: string | null) {
    if (!senderId) return "알 수 없음";
    return profileNames[senderId] ?? "구성원";
  }

  if (!open) {
    return (
      <button
        type="button"
        className="erp-messenger-fab"
        onClick={() => {
          setOpen(true);
          setHasUnseen(false);
        }}
        aria-label="사내메신저 열기"
      >
        💬
        {hasUnseen && <span className="erp-messenger-fab-badge" aria-hidden />}
      </button>
    );
  }

  return (
    <div className="erp-messenger-panel">
      <div className="erp-messenger-header">
        <span>사내메신저</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="최소화">
          ─
        </button>
      </div>

      <div className="erp-messenger-body">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--erp-text-muted)",
                  marginBottom: 2,
                  textAlign: mine ? "right" : "left",
                }}
              >
                {nameFor(m.sender_id)} · {new Date(m.created_at).toLocaleTimeString("ko-KR")}
              </div>
              <div
                style={{
                  background: mine ? "var(--erp-primary)" : "#f0f2f5",
                  color: mine ? "#fff" : "var(--erp-text)",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12.5,
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
                        fontSize: 11.5,
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
          <p className="erp-grid-empty" style={{ fontSize: 12 }}>
            아직 메시지가 없습니다. 첫 메시지를 남겨보세요.
          </p>
        )}
        <div ref={listEndRef} />
      </div>

      <form ref={formRef} action={formAction} className="erp-messenger-composer">
        <textarea
          name="content"
          placeholder="메시지를 입력하세요"
          rows={2}
          className="erp-input"
          style={{ flex: 1, resize: "none", fontSize: 12.5 }}
        />
        <div className="erp-messenger-composer-actions">
          <input type="file" name="file" style={{ fontSize: 11, maxWidth: 120 }} />
          <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
            {pending ? <span className="erp-spinner" aria-hidden /> : "전송"}
          </button>
        </div>
      </form>
      {state?.error && (
        <p style={{ padding: "0 12px 8px", color: "var(--erp-danger)", fontSize: 11.5 }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

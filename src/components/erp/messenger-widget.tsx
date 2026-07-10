"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, deleteMessage } from "@/app/(dashboard)/messenger/actions";
import type { MessengerMessage } from "@/lib/messenger-types";
import { fileKindIcon, formatFileSize, isImageFile } from "@/lib/file-display";

export type { MessengerMessage };

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
  const [sendError, setSendError] = useState<string | undefined>();
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [sending, startSendTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function nameFor(senderId: string | null) {
    if (!senderId) return "알 수 없음";
    return profileNames[senderId] ?? "구성원";
  }

  function handleSend(formData: FormData) {
    startSendTransition(async () => {
      const result = await sendMessage(undefined, formData);
      if (result?.error) {
        setSendError(result.error);
        return;
      }
      setSendError(undefined);
      formRef.current?.reset();
      setAttachedFileName(null);
      if (result?.message) {
        const sent = result.message;
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    });
  }

  function handleDelete(id: string, filePath: string | null) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("file_path", filePath ?? "");
      await deleteMessage(fd);
    });
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.currentTarget.value.trim() || attachedFileName) {
        formRef.current?.requestSubmit();
      }
    }
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
          const isImg = m.file_name ? isImageFile(m.file_name) : false;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "80%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--erp-text-muted)",
                  textAlign: mine ? "right" : "left",
                }}
              >
                {nameFor(m.sender_id)} · {new Date(m.created_at).toLocaleTimeString("ko-KR")}
              </div>

              {m.content && (
                <div
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
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
                </div>
              )}

              {m.file_url && m.file_name && (
                <div style={{ alignSelf: mine ? "flex-end" : "flex-start" }}>
                  {isImg ? (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="erp-attachment-image-link"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.file_url} alt={m.file_name} className="erp-attachment-image" />
                    </a>
                  ) : (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="erp-attachment-row"
                    >
                      <span className="erp-attachment-icon" aria-hidden>
                        {fileKindIcon(m.file_name)}
                      </span>
                      <span className="erp-attachment-info">
                        <span className="erp-attachment-name">{m.file_name}</span>
                        <span className="erp-attachment-meta">
                          {m.file_size ? formatFileSize(m.file_size) : ""}
                        </span>
                      </span>
                      <span className="erp-attachment-download" aria-hidden>
                        ⬇
                      </span>
                    </a>
                  )}
                </div>
              )}

              {mine && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id, m.file_path)}
                  style={{
                    alignSelf: "flex-end",
                    fontSize: 10,
                    color: "var(--erp-text-muted)",
                    background: "none",
                    border: "none",
                    padding: "2px 0",
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
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

      <form ref={formRef} action={handleSend} className="erp-messenger-composer">
        <textarea
          name="content"
          placeholder="메시지를 입력하세요 (Enter: 전송 / Shift+Enter: 줄바꿈)"
          rows={2}
          className="erp-input"
          style={{ flex: 1, resize: "none", fontSize: 12.5 }}
          onKeyDown={handleComposerKeyDown}
        />
        <div className="erp-messenger-composer-actions">
          <label className="erp-file-picker" title="파일 첨부">
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              className="erp-file-picker-input"
              onChange={(e) => setAttachedFileName(e.target.files?.[0]?.name ?? null)}
            />
            <span className="erp-file-picker-btn erp-file-picker-btn-icon">📎</span>
          </label>
          {attachedFileName && (
            <span className="erp-file-picker-name">
              {attachedFileName}
              <button
                type="button"
                onClick={() => {
                  setAttachedFileName(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="erp-file-picker-clear"
                aria-label="첨부 취소"
              >
                ✕
              </button>
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button type="submit" disabled={sending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
            {sending ? <span className="erp-spinner" aria-hidden /> : "전송"}
          </button>
        </div>
      </form>
      {sendError && (
        <p style={{ padding: "0 12px 8px", color: "var(--erp-danger)", fontSize: 11.5 }}>
          {sendError}
        </p>
      )}
    </div>
  );
}

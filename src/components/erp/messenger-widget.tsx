"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, deleteMessage } from "@/app/(dashboard)/messenger/actions";
import type { MessengerMessage } from "@/lib/messenger-types";
import { fileKindIcon, formatFileSize, isImageFile } from "@/lib/file-display";
import { FilePickerInput } from "@/components/file-picker-input";

export type { MessengerMessage };

function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE");
}

function formatDateLabel(key: string): string {
  const todayKey = new Date().toLocaleDateString("sv-SE");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("sv-SE");
  if (key === todayKey) return "오늘";
  if (key === yesterdayKey) return "어제";
  return new Date(key).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// 검색어와 일치하는 부분을 <mark>로 감싸 강조 표시한다.
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let pos = lower.indexOf(q);
  let key = 0;
  while (pos !== -1) {
    if (pos > idx) parts.push(text.slice(idx, pos));
    parts.push(
      <mark key={key++} className="erp-messenger-search-hit">
        {text.slice(pos, pos + q.length)}
      </mark>
    );
    idx = pos + q.length;
    pos = lower.indexOf(q, idx);
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}

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
  const [hasAttachment, setHasAttachment] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, startSendTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();
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
      setHasAttachment(false);
      setComposerKey((k) => k + 1);
      if (result?.message) {
        const sent = result.message;
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    });
  }

  function handleDelete(id: string, filePath: string | null) {
    if (!confirm("이 메시지를 삭제하시겠습니까?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("file_path", filePath ?? "");
      await deleteMessage(fd);
    });
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 한글 등 IME 조합 중에 눌린 Enter는 무시한다(조합 완료용 Enter가 전송으로
    // 잘못 튀는 것을 막기 위함). keyCode는 일부 구형 브라우저의 폴백.
    if (e.nativeEvent.isComposing) return;
    const isEnter = e.key === "Enter" || e.keyCode === 13;
    if (isEnter && !e.shiftKey) {
      e.preventDefault();
      if (e.currentTarget.value.trim() || hasAttachment) {
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

  const query = searchQuery.trim();
  const filteredMessages = query
    ? messages.filter(
        (m) =>
          m.content.toLowerCase().includes(query.toLowerCase()) ||
          (m.file_name?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : messages;

  const displayEntries = filteredMessages.reduce<{ dateLabel: string; message: MessengerMessage }[]>(
    (acc, m) => {
      const key = dateKey(m.created_at);
      const prevKey = acc.length ? dateKey(acc[acc.length - 1].message.created_at) : null;
      return [...acc, { dateLabel: key !== prevKey ? formatDateLabel(key) : "", message: m }];
    },
    []
  );

  return (
    <div className="erp-messenger-panel">
      <div className="erp-messenger-header">
        <span>사내메신저</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="최소화">
          ─
        </button>
      </div>

      <div className="erp-messenger-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 메시지 검색"
          className="erp-input"
          style={{ width: "100%", fontSize: 12 }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="erp-messenger-search-clear"
            aria-label="검색 지우기"
          >
            ✕
          </button>
        )}
      </div>

      <div className="erp-messenger-body">
        {displayEntries.map(({ dateLabel, message: m }) => {
          const mine = m.sender_id === currentUserId;
          const isImg = m.file_name ? isImageFile(m.file_name) : false;
          return (
            <Fragment key={m.id}>
              {dateLabel && (
                <div className="erp-messenger-date-divider">
                  <span>{dateLabel}</span>
                </div>
              )}
              <div
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
                    {highlightText(m.content, query)}
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
                          <span className="erp-attachment-name">{highlightText(m.file_name, query)}</span>
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
            </Fragment>
          );
        })}
        {!displayEntries.length && (
          <p className="erp-grid-empty" style={{ fontSize: 12 }}>
            {query ? "검색 결과가 없습니다." : "아직 메시지가 없습니다. 첫 메시지를 남겨보세요."}
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
          <FilePickerInput
            key={composerKey}
            name="file"
            iconOnly
            icon="📎"
            label="파일 첨부"
            onFileChange={(f) => setHasAttachment(!!f)}
          />
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

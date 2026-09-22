"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessage,
  deleteMessage,
  startDirectMessage,
  createGroup,
  leaveGroup,
} from "@/app/(dashboard)/messenger/actions";
import type { MessengerMessage, MessengerChannel } from "@/lib/messenger-types";
import { fileKindIcon, formatFileSize, isImageFile } from "@/lib/file-display";
import { FilePickerInput } from "@/components/file-picker-input";
import { useConfirmTwice } from "@/lib/use-confirm-twice";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

export type { MessengerMessage };

const MESSAGE_COLUMNS = "id, channel_id, sender_id, content, file_url, file_path, file_name, file_size, created_at";

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

function channelLabel(channel: MessengerChannel, profileNames: Record<string, string>, currentUserId: string): string {
  if (channel.type === "all") return "전체";
  if (channel.type === "group") return channel.name ?? "그룹";
  const otherId = channel.memberIds.find((id) => id !== currentUserId);
  return otherId ? (profileNames[otherId] ?? "구성원") : "DM";
}

function channelIcon(type: MessengerChannel["type"]): string {
  if (type === "all") return "💬";
  if (type === "group") return "👥";
  return "👤";
}

type View = "chat" | "list" | "newDm" | "newGroup";

// 좌측 메뉴 대신 우측 하단에 떠 있는 사내메신저 위젯. 평소엔 동그란 버튼으로
// 최소화돼 있다가 클릭하면 채팅창으로 펼쳐진다. 전체(회사 전체 공개
// 채널) + 1:1 DM + 그룹방 세 종류를 오갈 수 있다 — DM/그룹은 참여자만
// 볼 수 있고(RLS), 전체는 지금까지처럼 테넌트 전원에게 열려있다.
export function MessengerWidget({
  channels: initialChannels,
  activeChannelId: initialActiveChannelId,
  initialMessages,
  profileNames,
  currentUserId,
  isAdmin,
}: {
  channels: MessengerChannel[];
  activeChannelId: string | null;
  initialMessages: MessengerMessage[];
  profileNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [channels, setChannels] = useState(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialActiveChannelId);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, MessengerMessage[]>>(() =>
    initialActiveChannelId ? { [initialActiveChannelId]: initialMessages } : {}
  );
  const [unseenChannelIds, setUnseenChannelIds] = useState<Set<string>>(new Set());
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [channelError, setChannelError] = useState<string | undefined>();
  const confirmDelete = useConfirmTwice<string>();
  const [hasAttachment, setHasAttachment] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [pickedMemberIds, setPickedMemberIds] = useState<string[]>([]);
  const [sending, startSendTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();
  const [creatingChannel, startChannelTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const activeChannelIdRef = useRef(activeChannelId);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // 종/리본 드롭다운과 동일하게, 이 패널이 열려있는 동안은 Escape가 페이지
  // 전역 ESC 단축키(뒤로가기 등)로 새지 않고 패널만 닫는다 — 안 그러면
  // "/todos/[id]"처럼 자체 Escape 단축키가 있는 화면에서 메신저를 열어둔
  // 채 Escape를 누르면 패널은 그대로 열려있고 화면만 목록으로 튕겨나간다.
  useEscapeToClose(open, () => setOpen(false));

  useEffect(() => {
    const supabase = createClient();
    // 채널 필터 없이 전부 구독한다 — RLS가 이미 "내가 볼 수 있는 채널의
    // 메시지만" 걸러주므로, 여기서 받는 이벤트는 전부 내가 속한 채널
    // 것들이다. 채널마다 새로 구독을 맺는 대신 받은 메시지의 channel_id로
        // 어느 채널 버킷에 넣을지만 나눠서, 전환할 때 재구독 지연이 없다.
    const channel = supabase
      .channel("messenger_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messenger_messages" },
        (payload) => {
          const row = payload.new as MessengerMessage;
          setMessagesByChannel((prev) => {
            const bucket = prev[row.channel_id] ?? [];
            if (bucket.some((m) => m.id === row.id)) return prev;
            return { ...prev, [row.channel_id]: [...bucket, row] };
          });
          const isActiveAndOpen = openRef.current && row.channel_id === activeChannelIdRef.current;
          if (!isActiveAndOpen && row.sender_id !== currentUserId) {
            setHasUnseen(true);
            setUnseenChannelIds((prev) => new Set(prev).add(row.channel_id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messenger_messages" },
        (payload) => {
          const row = payload.old as { id: string; channel_id: string };
          setMessagesByChannel((prev) => {
            const bucket = prev[row.channel_id];
            if (!bucket) return prev;
            return { ...prev, [row.channel_id]: bucket.filter((m) => m.id !== row.id) };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (open && view === "chat") {
      listEndRef.current?.scrollIntoView();
    }
  }, [open, view, activeChannelId, messagesByChannel]);

  function nameFor(senderId: string | null) {
    if (!senderId) return "알 수 없음";
    return profileNames[senderId] ?? "구성원";
  }

  async function openChannel(channelId: string) {
    setActiveChannelId(channelId);
    setView("chat");
    setSearchQuery("");
    setUnseenChannelIds((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
    if (unseenChannelIds.size <= 1) setHasUnseen(false);

    if (!messagesByChannel[channelId]) {
      setLoadingChannel(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("messenger_messages")
        .select(MESSAGE_COLUMNS)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(100);
      setMessagesByChannel((prev) => ({ ...prev, [channelId]: (data ?? []).slice().reverse() }));
      setLoadingChannel(false);
    }
  }

  function handleSend(formData: FormData) {
    if (!activeChannelId) return;
    formData.set("channel_id", activeChannelId);
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
        setMessagesByChannel((prev) => {
          const bucket = prev[sent.channel_id] ?? [];
          if (bucket.some((m) => m.id === sent.id)) return prev;
          return { ...prev, [sent.channel_id]: [...bucket, sent] };
        });
      }
    });
  }

  function handleDelete(id: string, filePath: string | null) {
    if (!activeChannelId) return;
    const channelId = activeChannelId;
    // 브라우저 기본 confirm() 대신, 다른 곳의 "삭제 누르면 바로 안 지워지고
    // 한 번 더 확인" 원칙을 가볍게 맞춘 버전 — 좁은 말풍선 안이라 타이핑
    // 확인 코드까지는 과해서, 버튼을 두 번 눌러야 지워지는 방식으로 뺐다.
    confirmDelete.press(id, () => {
      setDeleteError(undefined);
      const bucket = messagesByChannel[channelId] ?? [];
      const removed = bucket.find((m) => m.id === id);
      const removedIndex = bucket.findIndex((m) => m.id === id);
      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).filter((m) => m.id !== id),
      }));
      startDeleteTransition(async () => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("file_path", filePath ?? "");
        const result = await deleteMessage(fd);
        // 삭제가 실패하면(RLS, 일시적 오류 등) 화면에서 지웠던 메시지를 원래
        // 위치로 되돌린다 — 아니면 삭제 안 됐는데도 내 화면에서만 사라진
        // 것처럼 보여서 다른 사람에게는 계속 보인다는 걸 알 방법이 없다.
        if (result.error && removed) {
          setMessagesByChannel((prev) => {
            const cur = prev[channelId] ?? [];
            if (cur.some((m) => m.id === id)) return prev;
            const next = [...cur];
            next.splice(Math.min(removedIndex, next.length), 0, removed);
            return { ...prev, [channelId]: next };
          });
          setDeleteError(result.error);
        }
      });
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

  function handleStartDm(otherUserId: string) {
    setChannelError(undefined);
    startChannelTransition(async () => {
      const result = await startDirectMessage(otherUserId);
      if (result?.error || !result?.channelId) {
        setChannelError(result?.error ?? "대화를 시작하지 못했습니다.");
        return;
      }
      const channelId = result.channelId;
      setChannels((prev) =>
        prev.some((c) => c.id === channelId)
          ? prev
          : [...prev, { id: channelId, type: "dm", name: null, memberIds: [currentUserId, otherUserId] }]
      );
      openChannel(channelId);
    });
  }

  function handleCreateGroup() {
    setChannelError(undefined);
    const fd = new FormData();
    fd.set("name", groupName);
    pickedMemberIds.forEach((id) => fd.append("member_id", id));
    startChannelTransition(async () => {
      const result = await createGroup(undefined, fd);
      if (result?.error || !result?.channelId) {
        setChannelError(result?.error ?? "그룹을 만들지 못했습니다.");
        return;
      }
      const channelId = result.channelId;
      setChannels((prev) => [
        ...prev,
        { id: channelId, type: "group", name: groupName.trim(), memberIds: [currentUserId, ...pickedMemberIds] },
      ]);
      setGroupName("");
      setPickedMemberIds([]);
      openChannel(channelId);
    });
  }

  function handleLeaveGroup(channelId: string) {
    startChannelTransition(async () => {
      const result = await leaveGroup(channelId);
      if (result.error) {
        setChannelError(result.error);
        return;
      }
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setMessagesByChannel((prev) => {
        const next = { ...prev };
        delete next[channelId];
        return next;
      });
      const allChannel = channels.find((c) => c.type === "all");
      setView("list");
      if (allChannel) setActiveChannelId(allChannel.id);
    });
  }

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );
  const messages = activeChannelId ? messagesByChannel[activeChannelId] ?? [] : [];
  const otherProfiles = useMemo(
    () => Object.entries(profileNames).filter(([id]) => id !== currentUserId),
    [profileNames, currentUserId]
  );

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
        {view === "chat" ? (
          <>
            <button type="button" onClick={() => setView("list")} aria-label="채널 목록">
              ‹ {activeChannel ? `${channelIcon(activeChannel.type)} ${channelLabel(activeChannel, profileNames, currentUserId)}` : "사내메신저"}
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="최소화">
              ─
            </button>
          </>
        ) : (
          <>
            <span>
              {view === "list" && "사내메신저"}
              {view === "newDm" && "새 대화 상대 선택"}
              {view === "newGroup" && "새 그룹 만들기"}
            </span>
            <button
              type="button"
              onClick={() => (view === "list" ? setOpen(false) : setView("list"))}
              aria-label={view === "list" ? "최소화" : "취소"}
            >
              {view === "list" ? "─" : "✕"}
            </button>
          </>
        )}
      </div>

      {view === "list" && (
        <div className="erp-messenger-body" style={{ padding: 0 }}>
          <div style={{ display: "flex", gap: 6, padding: 10, borderBottom: "1px solid var(--erp-border)" }}>
            <button type="button" className="erp-btn" style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} onClick={() => setView("newDm")}>
              + DM
            </button>
            <button type="button" className="erp-btn" style={{ flex: 1, minWidth: 0, fontSize: 11.5 }} onClick={() => setView("newGroup")}>
              + 그룹
            </button>
          </div>
          {channelError && (
            <p style={{ padding: "8px 12px 0", color: "var(--erp-danger)", fontSize: 11.5 }}>{channelError}</p>
          )}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openChannel(c.id)}
                className="erp-messenger-channel-row"
                style={{ position: "relative" }}
              >
                <span style={{ marginRight: 8 }}>{channelIcon(c.type)}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{channelLabel(c, profileNames, currentUserId)}</span>
                {unseenChannelIds.has(c.id) && <span className="erp-messenger-fab-badge" style={{ position: "static" }} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "newDm" && (
        <div className="erp-messenger-body" style={{ padding: 0, overflowY: "auto" }}>
          {otherProfiles.length === 0 && (
            <p className="erp-grid-empty" style={{ fontSize: 12 }}>
              대화할 수 있는 다른 구성원이 없습니다.
            </p>
          )}
          {otherProfiles.map(([id, name]) => (
            <button
              key={id}
              type="button"
              disabled={creatingChannel}
              onClick={() => handleStartDm(id)}
              className="erp-messenger-channel-row"
            >
              👤 {name}
            </button>
          ))}
        </div>
      )}

      {view === "newGroup" && (
        <div className="erp-messenger-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            autoComplete="off"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="그룹 이름"
            className="erp-input"
            style={{ fontSize: 12.5 }}
          />
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {otherProfiles.map(([id, name]) => (
              <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 2px" }}>
                <input
                  type="checkbox"
                  checked={pickedMemberIds.includes(id)}
                  onChange={(e) =>
                    setPickedMemberIds((prev) =>
                      e.target.checked ? [...prev, id] : prev.filter((m) => m !== id)
                    )
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={creatingChannel || !groupName.trim() || pickedMemberIds.length === 0}
            onClick={handleCreateGroup}
            className="erp-btn erp-btn-primary"
          >
            {creatingChannel ? "만드는 중..." : "그룹 만들기"}
          </button>
        </div>
      )}

      {view === "chat" && (
        <>
          <div className="erp-messenger-search">
            <input
              type="text"
              autoComplete="off"
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
            {loadingChannel ? (
              <p className="erp-grid-empty" style={{ fontSize: 12 }}>
                불러오는 중...
              </p>
            ) : (
              <>
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
                              background: mine ? "var(--erp-primary)" : "var(--erp-hover)",
                              color: mine ? "#fff" : "var(--erp-text)",
                              padding: "6px 10px",
                              borderRadius: 0,
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

                        {(mine || isAdmin) && (
                          <div style={{ alignSelf: mine ? "flex-end" : "flex-start", display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleDelete(m.id, m.file_path)}
                              style={{
                                fontSize: 10,
                                color: confirmDelete.isArmed(m.id) ? "var(--erp-danger)" : "var(--erp-text-muted)",
                                fontWeight: confirmDelete.isArmed(m.id) ? 700 : 400,
                                background: "none",
                                border: "none",
                                padding: "2px 0",
                                cursor: "pointer",
                              }}
                            >
                              {confirmDelete.isArmed(m.id) ? "한 번 더 누르면 삭제" : "삭제"}
                            </button>
                            {confirmDelete.isArmed(m.id) && (
                              <button
                                type="button"
                                onClick={confirmDelete.reset}
                                style={{
                                  fontSize: 10,
                                  color: "var(--erp-text-muted)",
                                  background: "none",
                                  border: "none",
                                  padding: "2px 0",
                                  cursor: "pointer",
                                }}
                              >
                                취소
                              </button>
                            )}
                          </div>
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
              </>
            )}
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
              {activeChannel?.type === "group" && (
                <button
                  type="button"
                  onClick={() => handleLeaveGroup(activeChannel.id)}
                  className="erp-btn"
                  style={{ minWidth: 0, fontSize: 10.5 }}
                >
                  그룹 나가기
                </button>
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
          {deleteError && (
            <p style={{ padding: "0 12px 8px", color: "var(--erp-danger)", fontSize: 11.5 }}>
              삭제 실패: {deleteError}
            </p>
          )}
        </>
      )}
    </div>
  );
}

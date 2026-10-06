"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessage,
  deleteMessage,
  startDirectMessage,
  createGroup,
  leaveGroup,
} from "@/app/(dashboard)/messenger/actions";
import type { MessengerMessage, MessengerChannel } from "@/lib/messenger-types";
import { fileKind, formatFileSize, isImageFile } from "@/lib/file-display";
import { FilePickerInput } from "@/components/file-picker-input";
import { useConfirmTwice } from "@/lib/use-confirm-twice";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { ListPageHeader } from "@/components/erp/page-header";
import { PaperclipIcon, ChatIcon, GroupIcon, DownloadIcon, FileKindIcon } from "@/components/erp/groupware-icons";

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

// "전체"/그룹 채널은 선 아이콘으로, 1:1 DM은 상대방 이니셜 아바타로
// 보여준다(이모지 👤보다 실제로 누구인지 한눈에 더 잘 들어온다).
function ChannelAvatar({ channel, profileNames, currentUserId }: { channel: MessengerChannel; profileNames: Record<string, string>; currentUserId: string }) {
  if (channel.type === "all") {
    return (
      <span className="erp-icon" style={{ width: 20, height: 20, color: "var(--erp-primary)" }} aria-hidden>
        <ChatIcon />
      </span>
    );
  }
  if (channel.type === "group") {
    return (
      <span className="erp-icon" style={{ width: 20, height: 20, color: "var(--erp-primary)" }} aria-hidden>
        <GroupIcon />
      </span>
    );
  }
  const label = channelLabel(channel, profileNames, currentUserId);
  return (
    <span className="erp-avatar" style={{ width: 22, height: 22, fontSize: 10 }} aria-hidden>
      {label[0] ?? "?"}
    </span>
  );
}

type View = "chat" | "list" | "newDm" | "newGroup";

// 우측하단에 항상 떠 있던 팝업 위젯을 없애고, 다른 화면들처럼 좌측 메뉴
// (그룹웨어 > 메신저)로 들어오는 일반 페이지로 바꿨다 — 팝업이 화면을
// 가리고, 숨기기/위치이동까지 신경 써야 했던 것에 비해 메뉴 하나로
// 찾아 들어오는 편이 낫다는 판단(사용자 피드백). 이 컴포넌트는 /messenger
// 페이지를 열었을 때만 마운트되고, 그래서 실시간 새 메시지 구독도 이
// 페이지를 보고 있는 동안만 돈다(다른 화면에 있는 동안의 새 메시지는
// 웹푸시로 대신 알려준다).
//
// 예전엔 대화/메일/알림 3탭이었는데, 메일함은 아예 별도 화면(/mail,
// 독립된 feature 토글)이라 그 영역만 떼어내는 게 더 안전해서 탭에서
// 뺐고(여기서 미리보기도 안 보여준다 — "메일함 전체보기" 성격의 화면이
// 메신저 안에 반쪽만 있는 게 오히려 헷갈린다는 지적), 알림 탭이 보여주던
// 것들(거래처 발주/안전재고/할일마감 등)은 전부 "전체" 대화방에
// 시스템봇(sender_id=null) 메시지로 흡수했다 — 알림함을 따로 열어볼
// 필요 없이 다들 늘 보는 대화 목록 안에서 바로 확인된다.
export function MessengerPage({
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
  const [view, setView] = useState<View>("list");
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sending, startSendTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();
  const [creatingChannel, startChannelTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const activeChannelIdRef = useRef(activeChannelId);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // "홈 화면"(대화 탭의 채널 목록)에서는 Esc가 대시보드로 나가고, 대화창/새
  // DM·그룹 만들기처럼 하위 화면에서는 목록으로 한 단계만 돌아간다 —
  // 목록/상세가 있는 다른 화면들의 ESC 관례와 맞춘다.
  useEscapeToClose(true, () => {
    if (view !== "list") {
      setView("list");
    } else {
      router.push("/dashboard");
    }
  });

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

  // 알림(새 결재 요청 등과 같은 방식의 메신저 DM/그룹 알림, notify())을
  // 클릭해서 들어온 경우, 그 알림이 가리키는 대화를 바로 열어준다.
  // ?openMessenger=<channelId>를 한 번 읽고 나면 주소를 원래대로 되돌려서
  // (replace) 뒤로가기/새로고침 때 같은 채널이 계속 다시 열리지 않게 한다.
  // channels에 없는 id(권한 없는 채널, 오타 등)는 조용히 무시한다.
  useEffect(() => {
    const targetChannelId = searchParams.get("openMessenger");
    if (!targetChannelId) return;
    if (!channels.some((c) => c.id === targetChannelId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount
    openChannel(targetChannelId);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("openMessenger");
    const query = next.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 쿼리 1회만 확인한다
  }, []);

  useEffect(() => {
    const supabase = createClient();
    // 채널 필터 없이 전부 구독한다 — RLS가 이미 "내가 볼 수 있는 채널의
    // 메시지만" 걸러주므로, 여기서 받는 이벤트는 전부 내가 속한 채널
    // 것들이다. 채널마다 새로 구독을 맺는 대신 받은 메시지의 channel_id로
    // 어느 채널 버킷에 넣을지만 나눠서, 전환할 때 재구독 지연이 없다. 이
    // 페이지가 열려 있는 동안만 도는 구독이라, 다른 화면에 있는 동안
    // 온 메시지는 이 목록에 실시간으로 반영되지 않는다(웹푸시로 대신
    // 알려줌).
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
          const isActiveChannel = row.channel_id === activeChannelIdRef.current;
          if (!isActiveChannel && row.sender_id !== currentUserId) {
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
    if (view === "chat") {
      listEndRef.current?.scrollIntoView();
    }
  }, [view, activeChannelId, messagesByChannel]);

  function nameFor(senderId: string | null) {
    // sender_id가 없는 메시지는 사람이 아니라 시스템이 자동으로 남긴
    // 것이다(예: 거래처 포털 발주 알림 — 포털 계정은 profiles가 없어
    // sender_id를 달 수 없다).
    if (!senderId) return "시스템";
    return profileNames[senderId] ?? "구성원";
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

  const headerTitle =
    view === "chat" && activeChannel
      ? `그룹웨어 > 메신저 > ${channelLabel(activeChannel, profileNames, currentUserId)}`
      : "그룹웨어 > 메신저";

  return (
    <div>
      <ListPageHeader
        title={headerTitle}
        actions={
          view !== "list" ? (
            <button type="button" className="erp-btn" onClick={() => setView("list")}>
              ‹ 목록으로
            </button>
          ) : undefined
        }
      />

      <div className="erp-messenger-page">
        {/* 좌측 직원/대화 목록 + 우측 대화창의 2단 구성. 넓은 화면에서는
            항상 둘 다 보이고(메신저 앱 통상 레이아웃), 좁은 화면에서는
            data-view에 따라 한쪽만 보이게 CSS로 전환한다(erp-theme.css의
            @media 참고). */}
        <div className="erp-messenger-layout" data-view={view}>
            <div className="erp-messenger-sidebar">
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
                    className={`erp-messenger-channel-row${view === "chat" && c.id === activeChannelId ? " active" : ""}`}
                    style={{ position: "relative" }}
                  >
                    <span style={{ marginRight: 8, display: "inline-flex" }}>
                      <ChannelAvatar channel={c} profileNames={profileNames} currentUserId={currentUserId} />
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>{channelLabel(c, profileNames, currentUserId)}</span>
                    {unseenChannelIds.has(c.id) && <span className="erp-messenger-unread-dot" style={{ position: "static" }} aria-hidden />}
                  </button>
                ))}
              </div>
            </div>

            <div className="erp-messenger-main">
              {view === "list" && (
                <div className="erp-messenger-empty-state">왼쪽에서 대화를 선택하거나 새로 시작해보세요.</div>
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
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="erp-avatar" style={{ width: 22, height: 22, fontSize: 10 }} aria-hidden>
                        {name[0] ?? "?"}
                      </span>
                      {name}
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
                                          <span className="erp-icon" style={{ width: 16, height: 16, color: "var(--erp-primary)" }}>
                                            <FileKindIcon kind={fileKind(m.file_name)} />
                                          </span>
                                        </span>
                                        <span className="erp-attachment-info">
                                          <span className="erp-attachment-name">{highlightText(m.file_name, query)}</span>
                                          <span className="erp-attachment-meta">
                                            {m.file_size ? formatFileSize(m.file_size) : ""}
                                          </span>
                                        </span>
                                        <span className="erp-attachment-download" aria-hidden>
                                          <span className="erp-icon" style={{ width: 13, height: 13 }}>
                                            <DownloadIcon />
                                          </span>
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
                        icon={
                          <span className="erp-icon" style={{ width: 16, height: 16 }}>
                            <PaperclipIcon />
                          </span>
                        }
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
          </div>
        </div>
      </div>
  );
}



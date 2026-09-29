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
import { fileKindIcon, formatFileSize, isImageFile } from "@/lib/file-display";
import { FilePickerInput } from "@/components/file-picker-input";
import { useConfirmTwice } from "@/lib/use-confirm-twice";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notification-actions";
import { ListPageHeader } from "@/components/erp/page-header";

export type { MessengerMessage };

export type MailPreviewItem = {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  sentAt: string | null;
  isRead: boolean;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  isRead: boolean;
  createdAt: string;
};

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

const NOTIF_ICONS: Record<string, string> = {
  announcement: "📢",
  messenger_group: "👥",
  messenger_dm: "👤",
  approval_pending: "📝",
  approval_result: "✅",
  mail: "📧",
};

function notifIcon(type: string): string {
  return NOTIF_ICONS[type] ?? "🔔";
}

// 알림/메일 미리보기 목록에서 "3분 전"/"어제" 같은 상대 시각을 짧게
// 보여준다 — 메신저 쪽 날짜 구분선(formatDateLabel)과 달리 여기는 한
// 줄짜리 목록이라 절대 날짜 대신 상대 시각이 더 쓸모 있다.
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

type View = "chat" | "list" | "newDm" | "newGroup";
type HubTab = "chat" | "mail" | "notifications";

// 우측하단에 항상 떠 있던 팝업 위젯을 없애고, 다른 화면들처럼 좌측 메뉴
// (그룹웨어 > 메신저)로 들어오는 일반 페이지로 바꿨다 — 팝업이 화면을
// 가리고, 숨기기/위치이동까지 신경 써야 했던 것에 비해 메뉴 하나로
// 찾아 들어오는 편이 낫다는 판단(사용자 피드백). 대화/메일/알림 3탭
// 구성과 내부 로직은 위젯 시절 그대로 옮겨왔다 — 다른 점은 이제 이
// 컴포넌트는 /messenger 페이지를 열었을 때만 마운트되고(이전엔 항상
// 화면 전역에 떠 있었음), 그래서 실시간 새 메시지 구독도 이 페이지를
// 보고 있는 동안만 돈다(다른 화면에 있는 동안의 새 메시지는 웹푸시/
// 알림함 쪽에서 대신 알려준다).
export function MessengerPage({
  channels: initialChannels,
  activeChannelId: initialActiveChannelId,
  initialMessages,
  profileNames,
  currentUserId,
  isAdmin,
  mailEnabled,
  initialMailPreview,
  initialMailUnreadCount,
  initialNotifications,
  initialNotifUnreadCount,
}: {
  channels: MessengerChannel[];
  activeChannelId: string | null;
  initialMessages: MessengerMessage[];
  profileNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  // 메일 기능 자체가 꺼져 있거나(테넌트 기능관리), 로그인한 사람이 아직
  // 메일 계정을 연동하지 않았으면 메일 탭을 아예 숨긴다 — 탭만 있고
  // 눌러도 빈 화면만 나오는 걸 방지.
  mailEnabled: boolean;
  initialMailPreview: MailPreviewItem[];
  initialMailUnreadCount: number;
  initialNotifications: NotificationItem[];
  initialNotifUnreadCount: number;
}) {
  const [hasUnseen, setHasUnseen] = useState(false);
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
  // 대화/메일/알림 3탭 허브 — 대화 탭은 기존 view(list/chat/newDm/newGroup)
  // 상태를 그대로 쓰고, 메일/알림 탭은 여기 hubTab으로만 구분한다. 메일
  // 미리보기/알림 목록은 최초 진입 시 서버가 내려준 값으로 시작하고, 알림은
  // 읽음 처리를 낙관적으로 반영해야 해서 로컬 state로 따로 든다.
  const [hubTab, setHubTab] = useState<HubTab>("chat");
  const [mailPreview] = useState(initialMailPreview);
  const [mailUnreadCount] = useState(initialMailUnreadCount);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notifUnreadCount, setNotifUnreadCount] = useState(initialNotifUnreadCount);
  const [markingAllRead, startMarkAllTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleOpenNotification(n: NotificationItem) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setNotifUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(n.id);
    }
    if (n.url) router.push(n.url);
  }

  function handleMarkAllNotificationsRead() {
    if (notifUnreadCount === 0) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setNotifUnreadCount(0);
    startMarkAllTransition(async () => {
      await markAllNotificationsRead();
    });
  }

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
    if (hubTab === "chat" && view !== "list") {
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
    setHubTab("chat");
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
    if (view === "chat") {
      listEndRef.current?.scrollIntoView();
    }
  }, [view, activeChannelId, messagesByChannel]);

  function nameFor(senderId: string | null) {
    if (!senderId) return "알 수 없음";
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

  const anyChatUnseen = hasUnseen || unseenChannelIds.size > 0;
  const headerTitle =
    hubTab === "chat" && view === "chat" && activeChannel
      ? `그룹웨어 > 메신저 > ${channelIcon(activeChannel.type)} ${channelLabel(activeChannel, profileNames, currentUserId)}`
      : "그룹웨어 > 메신저";

  return (
    <div>
      <ListPageHeader
        title={headerTitle}
        actions={
          hubTab === "chat" && view !== "list" ? (
            <button type="button" className="erp-btn" onClick={() => setView("list")}>
              ‹ 목록으로
            </button>
          ) : undefined
        }
      />

      <div className="erp-messenger-page">
        <div className="erp-messenger-tabs">
          <button
            type="button"
            className={`erp-messenger-tab${hubTab === "chat" ? " active" : ""}`}
            onClick={() => setHubTab("chat")}
          >
            💬 대화
            {anyChatUnseen && <span className="erp-messenger-tab-dot" aria-hidden />}
          </button>
          {mailEnabled && (
            <button
              type="button"
              className={`erp-messenger-tab${hubTab === "mail" ? " active" : ""}`}
              onClick={() => setHubTab("mail")}
            >
              📧 메일
              {mailUnreadCount > 0 && <span className="erp-messenger-tab-count">{mailUnreadCount}</span>}
            </button>
          )}
          <button
            type="button"
            className={`erp-messenger-tab${hubTab === "notifications" ? " active" : ""}`}
            onClick={() => setHubTab("notifications")}
          >
            🔔 알림
            {notifUnreadCount > 0 && <span className="erp-messenger-tab-count">{notifUnreadCount}</span>}
          </button>
        </div>

        {hubTab === "mail" && (
          <div className="erp-messenger-body" style={{ padding: 0 }}>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {mailPreview.length === 0 && (
                <p className="erp-grid-empty" style={{ fontSize: 12 }}>
                  받은 메일이 없습니다.
                </p>
              )}
              {mailPreview.map((m) => (
                <a
                  key={m.id}
                  href={`/mail?id=${m.id}`}
                  className="erp-messenger-channel-row"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!m.isRead && <span className="erp-messenger-unread-dot" style={{ position: "static" }} aria-hidden />}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: m.isRead ? 500 : 700,
                      }}
                    >
                      {m.subject || "(제목 없음)"}
                    </span>
                    <span style={{ flex: "0 0 auto", fontSize: 10.5, color: "var(--erp-text-muted)" }}>
                      {formatRelativeTime(m.sentAt)}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--erp-text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.fromName || m.fromAddress || "발신자 미상"}
                  </span>
                </a>
              ))}
            </div>
            <a href="/mail" className="erp-btn" style={{ margin: 10, textAlign: "center", fontSize: 12 }}>
              메일함 전체보기
            </a>
          </div>
        )}

        {hubTab === "notifications" && (
          <div className="erp-messenger-body" style={{ padding: 0 }}>
            {notifUnreadCount > 0 && (
              <div style={{ padding: "8px 10px 0", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsRead}
                  disabled={markingAllRead}
                  style={{ fontSize: 11, color: "var(--erp-primary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  모두 읽음
                </button>
              </div>
            )}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {notifications.length === 0 && (
                <p className="erp-grid-empty" style={{ fontSize: 12 }}>
                  알림이 없습니다.
                </p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenNotification(n)}
                  className="erp-messenger-channel-row"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span aria-hidden>{notifIcon(n.type)}</span>
                    {!n.isRead && <span className="erp-messenger-unread-dot" style={{ position: "static" }} aria-hidden />}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: n.isRead ? 500 : 700,
                      }}
                    >
                      {n.title}
                    </span>
                    <span style={{ flex: "0 0 auto", fontSize: 10.5, color: "var(--erp-text-muted)" }}>
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </span>
                  {n.body && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--erp-text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {n.body}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {hubTab === "chat" && view === "list" && (
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
                  {unseenChannelIds.has(c.id) && <span className="erp-messenger-unread-dot" style={{ position: "static" }} aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}

        {hubTab === "chat" && view === "newDm" && (
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

        {hubTab === "chat" && view === "newGroup" && (
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

        {hubTab === "chat" && view === "chat" && (
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
    </div>
  );
}

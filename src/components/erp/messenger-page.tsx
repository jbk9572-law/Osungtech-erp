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
  resolveMessengerAttachmentUrl,
  markMessengerChannelRead,
} from "@/app/(dashboard)/messenger/actions";
import type { MessengerMessage, MessengerChannel, MessengerErpRef } from "@/lib/messenger-types";
import { fileKind, formatFileSize, isImageFile } from "@/lib/file-display";
import { FilePickerInput } from "@/components/file-picker-input";
import { useConfirmTwice } from "@/lib/use-confirm-twice";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { ListPageHeader } from "@/components/erp/page-header";
import { PaperclipIcon, DownloadIcon, FileKindIcon, SendIcon } from "@/components/erp/groupware-icons";
import { ChannelAvatar, channelLabel } from "@/components/erp/messenger-channel";

export type { MessengerMessage };

const MESSAGE_COLUMNS = "id, channel_id, sender_id, content, file_url, file_path, file_name, file_size, erp_ref, created_at";

// 메신저 목업의 하단 빠른명령 바(/매출전표 /재고조회 /게시판공지
// /일정마감) — 누르면 입력창에 명령어만 채워주고, 뒤에 전표번호/
// 품목명 등을 마저 타이핑해서 보내면 actions.ts의 sendMessage가
// 실제 데이터를 조회해 카드로 바꿔준다.
const ERP_COMMANDS = [
  { prefix: "/매출전표", label: "매출전표", icon: "📊" },
  { prefix: "/재고조회", label: "재고조회", icon: "📦" },
  { prefix: "/게시판공지", label: "게시판공지", icon: "📌" },
  { prefix: "/일정마감", label: "일정마감", icon: "⏰" },
] as const;

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

// 사원목록(roster)/채팅방목록(rooms)/대화창(chat)/그룹만들기(newGroup) —
// 넓은 화면에서는 roster+rooms+본문이 항상 셋 다 보이는 3단 레이아웃이라
// view는 "본문 자리에 뭘 보여줄지"만 정하고(chat|newGroup, 그 외엔 빈
// 상태), 좁은 화면에서는 이 값이 그대로 "지금 전체화면으로 보여줄 패널
// 하나"가 된다(roster|rooms|chat|newGroup, erp-theme.css의 data-view
// 참고). 예전의 "newDm"은 본문 자리를 밀어내는 임시 화면이었는데, 항상
// 보이는 사원목록 패널로 승격되며 사라졌다 — 거기서 사람을 누르면 바로
// DM이 열린다.
type View = "chat" | "rooms" | "roster" | "newGroup";

// R2로 전환된 첨부(messenger/actions.ts의 preferR2)는 file_url이 비어
// 있고 file_path만 있다 — Supabase Storage 영구 URL과 달리 R2는 서버에서
// 그때그때 짧게 서명해야 하므로, 렌더링 시점에 resolveMessengerAttachmentUrl
// 서버 액션으로 한 번 받아와서 쓴다. 기존처럼 file_url이 이미 있으면
// (예전 Supabase 첨부) 그대로 쓰고 추가 요청을 하지 않는다.
function useAttachmentUrl(fileUrl: string | null, filePath: string | null): string | null {
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (fileUrl || !filePath) return;
    let cancelled = false;
    resolveMessengerAttachmentUrl(filePath).then((url) => {
      if (!cancelled) setFetched(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, filePath]);
  // 메시지 하나당 이 훅이 한 번만 쓰이고(컴포넌트가 message.id로 keyed됨)
  // fileUrl/filePath가 생성 이후 바뀌지 않으므로, fetched가 다른 메시지의
  // 값과 섞일 일은 없다.
  return fileUrl ?? fetched;
}

function MessengerAttachmentBlock({
  fileUrl,
  filePath,
  fileName,
  fileSize,
  isImg,
  query,
}: {
  fileUrl: string | null;
  filePath: string | null;
  fileName: string;
  fileSize: number | null;
  isImg: boolean;
  query: string;
}) {
  const url = useAttachmentUrl(fileUrl, filePath);

  if (!url) {
    return (
      <div className="erp-messenger-bubble-attachment">
        <div className="erp-attachment-row" style={{ opacity: 0.6 }}>
          <span className="erp-attachment-info">
            <span className="erp-attachment-name">{fileName}</span>
            <span className="erp-attachment-meta">불러오는 중...</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-messenger-bubble-attachment">
      {isImg ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="erp-attachment-image-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={fileName} className="erp-attachment-image" />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="erp-attachment-row">
          <span className="erp-attachment-icon" aria-hidden>
            <span className="erp-icon erp-u-text" style={{ width: 16, height: 16 }}>
              <FileKindIcon kind={fileKind(fileName)} />
            </span>
          </span>
          <span className="erp-attachment-info">
            <span className="erp-attachment-name">{highlightText(fileName, query)}</span>
            <span className="erp-attachment-meta">{fileSize ? formatFileSize(fileSize) : ""}</span>
          </span>
          <span className="erp-attachment-download" aria-hidden>
            <span className="erp-icon" style={{ width: 13, height: 13 }}>
              <DownloadIcon />
            </span>
          </span>
        </a>
      )}
    </div>
  );
}

const ERP_REF_ICON: Record<MessengerErpRef["kind"], string> = {
  sale: "📊",
  inventory: "📦",
  announcement: "📌",
  followup: "⏰",
};

// /매출전표 등 명령어로 보낸 메시지가 품은 "ERP 연동 카드" — 종류별로
// 아이콘만 바뀌고 나머지(제목/뱃지/라벨-값 줄/링크)는 전부 공통 렌더링
// 이다. 새 명령어가 actions.ts에 추가돼도 kind를 ERP_REF_ICON에 한 줄만
// 추가하면 이 컴포넌트는 그대로 재사용된다.
function ErpRefCard({ erpRef }: { erpRef: MessengerErpRef }) {
  return (
    <a href={erpRef.href} className="erp-messenger-erp-card">
      <div className="erp-messenger-erp-card-head">
        <span aria-hidden>{ERP_REF_ICON[erpRef.kind]}</span>
        <span className="erp-messenger-erp-card-title">{erpRef.title}</span>
        {erpRef.badge && <span className="erp-messenger-erp-card-badge">{erpRef.badge}</span>}
      </div>
      <div className="erp-messenger-erp-card-lines">
        {erpRef.lines.map((line) => (
          <div key={line.label} className="erp-messenger-erp-card-line">
            <span className="erp-messenger-erp-card-label">{line.label}</span>
            <span>{line.value}</span>
          </div>
        ))}
      </div>
    </a>
  );
}

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
  const [view, setView] = useState<View>("rooms");
  const [rosterQuery, setRosterQuery] = useState("");
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const activeChannelIdRef = useRef(activeChannelId);
  const viewRef = useRef<View>("rooms");

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // "홈 화면"(채팅방목록)에서는 Esc가 대시보드로 나가고, 대화창/그룹
  // 만들기처럼 하위 화면이나 사원목록에서는 채팅방목록으로 한 단계만
  // 돌아간다 — 목록/상세가 있는 다른 화면들의 ESC 관례와 맞춘다.
  useEscapeToClose(true, () => {
    if (view !== "rooms") {
      setView("rooms");
    } else {
      router.push("/dashboard");
    }
  });

  async function openChannel(channelId: string) {
    setActiveChannelId(channelId);
    setView("chat");
    void markMessengerChannelRead(channelId); // 메인 화면 "메신저" 탭의 안 읽은 개수용
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
      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: (data ?? []).slice().reverse() as unknown as MessengerMessage[],
      }));
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
          if (isActiveChannel && viewRef.current === "chat" && row.sender_id !== currentUserId) {
            void markMessengerChannelRead(row.channel_id);
          }
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

  function insertCommand(prefix: string) {
    const el = composerRef.current;
    if (!el) return;
    el.value = el.value.trim() ? `${el.value.trim()} ${prefix} ` : `${prefix} `;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
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
      setView("rooms");
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
  const rosterQueryTrimmed = rosterQuery.trim().toLowerCase();
  const filteredRoster = rosterQueryTrimmed
    ? otherProfiles.filter(([, name]) => name.toLowerCase().includes(rosterQueryTrimmed))
    : otherProfiles;

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
  const isDrilledIn = view === "chat" || view === "newGroup";
  // split3-shell 공용 모바일 규칙은 "list"(카테고리+목록)/"detail" 2단만
  // 알고 있어서, 메신저만 더 필요한 "사원목록만"/"채팅방목록만" 중간
  // 상태 2개는 erp-messenger-split3 스코프의 별도 규칙으로 추가한다
  // (erp-theme.css 참고) — 그래서 roster/rooms는 그대로 넘기고
  // chat/newGroup만 "detail"로 합친다.
  const mobileView = isDrilledIn ? "detail" : view === "roster" ? "roster" : "rooms";

  return (
    <div className="erp-comm-shell">
      <ListPageHeader
        title={headerTitle}
        actions={
          isDrilledIn ? (
            <button type="button" className="erp-btn" onClick={() => setView("rooms")}>
              ‹ 목록으로
            </button>
          ) : undefined
        }
      />

      {!isDrilledIn && (
        <div className="erp-messenger-mobile-tabs">
          <button
            type="button"
            className={`erp-messenger-mobile-tab${view === "roster" ? " active" : ""}`}
            onClick={() => setView("roster")}
          >
            사원
          </button>
          <button
            type="button"
            className={`erp-messenger-mobile-tab${view !== "roster" ? " active" : ""}`}
            onClick={() => setView("rooms")}
          >
            채팅방
          </button>
        </div>
      )}

      {/* 메일함/게시판과 같은 .erp-split3-shell 3분할 — 왼쪽부터 사원목록
          (카테고리 사이드바 역할) → 채팅방목록 → 대화창. 넓은 화면에서는
          셋 다 항상 보이고, 좁은 화면에서는 mobileView가 가리키는 패널
          하나만 보이게 CSS로 전환한다(erp-theme.css의 @media 참고). */}
      <div className="erp-split3-shell erp-messenger-split3" data-mobile-view={mobileView}>
        <nav className="erp-cat-sidebar erp-messenger-roster" aria-label="사원목록">
          <div className="erp-messenger-roster-head">사원목록</div>
          <div className="erp-u-pad-8-8">
            <input
              type="text"
              autoComplete="off"
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder="🔍 이름 검색"
              className="erp-input erp-u-w-full erp-u-text-compact"
            />
          </div>
          <div className="erp-u-flex-1 erp-u-overflow-y-auto">
            {filteredRoster.map(([id, name]) => (
              <button
                key={id}
                type="button"
                disabled={creatingChannel}
                onClick={() => handleStartDm(id)}
                className="erp-messenger-channel-row erp-u-flex erp-u-items-center erp-u-gap-8"
              >
                <span className="erp-avatar erp-u-h-22" style={{ width: 22, fontSize: 10 }} aria-hidden>
                  {name[0] ?? "?"}
                </span>
                {name}
              </button>
            ))}
            {filteredRoster.length === 0 && (
              <p className="erp-grid-empty erp-u-text-sm erp-u-pad-8-10">
                {rosterQueryTrimmed ? "검색 결과가 없습니다." : "대화할 수 있는 다른 구성원이 없습니다."}
              </p>
            )}
          </div>
        </nav>

        <section className="erp-split-list erp-messenger-sidebar">
          <div className="erp-split-list-head">
            <span>채팅방목록</span>
            <button type="button" className="erp-btn erp-u-minw-0 erp-u-text-sm" onClick={() => setView("newGroup")}>
              + 그룹
            </button>
          </div>
          {channelError && (
            <p className="erp-u-danger erp-u-text-sm" style={{ padding: "8px 12px 0" }}>{channelError}</p>
          )}
          <div className="erp-split-list-body">
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openChannel(c.id)}
                className={`erp-messenger-channel-row${view === "chat" && c.id === activeChannelId ? " active" : ""}`}
                style={{ position: "relative" }}
              >
                <span className="erp-u-mr-8 erp-u-inline-flex">
                  <ChannelAvatar channel={c} profileNames={profileNames} currentUserId={currentUserId} />
                </span>
                <span className="erp-u-flex-1 erp-u-text-left">{channelLabel(c, profileNames, currentUserId)}</span>
                {unseenChannelIds.has(c.id) && <span className="erp-messenger-unread-dot" style={{ position: "static" }} aria-hidden />}
              </button>
            ))}
          </div>
        </section>

        <div className="erp-split-detail erp-messenger-main">
              {!isDrilledIn && (
                <div className="erp-messenger-empty-state">왼쪽에서 사원을 골라 DM을 시작하거나, 채팅방을 선택해보세요.</div>
              )}

              {view === "newGroup" && (
                <div className="erp-messenger-body erp-u-flex erp-u-gap-8 erp-u-col">
                  <input
                    type="text"
                    autoComplete="off"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="그룹 이름"
                    className="erp-input erp-u-text-base"
                  />
                  <div className="erp-u-flex erp-u-flex-1 erp-u-col erp-u-gap-4 erp-u-overflow-y-auto">
                    {otherProfiles.map(([id, name]) => (
                      <label className="erp-u-flex erp-u-items-center erp-u-gap-8 erp-u-text-base erp-u-pad-4-2" key={id}>
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

              {view === "chat" && activeChannel && (
                <>
                  <div className="erp-messenger-chat-header">
                    <ChannelAvatar channel={activeChannel} profileNames={profileNames} currentUserId={currentUserId} size={36} />
                    <span className="erp-messenger-chat-header-name">
                      {channelLabel(activeChannel, profileNames, currentUserId)}
                    </span>
                    <span className="erp-messenger-erp-badge">ERP 연동 활성화됨</span>
                  </div>

                  <div className="erp-messenger-search">
                    <input
                      type="text"
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 메시지 검색"
                      className="erp-input erp-u-w-full erp-u-text-compact"
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
                      <p className="erp-grid-empty erp-u-text-compact">
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
                              <div className="erp-messenger-bubble-group" data-mine={mine ? "1" : undefined}>
                                <div className="erp-messenger-bubble-meta">
                                  {nameFor(m.sender_id)} · {new Date(m.created_at).toLocaleTimeString("ko-KR")}
                                </div>

                                {m.erp_ref && <ErpRefCard erpRef={m.erp_ref} />}

                                {m.content && (
                                  <div className="erp-messenger-bubble">{highlightText(m.content, query)}</div>
                                )}

                                {(m.file_url || m.file_path) && m.file_name && (
                                  <MessengerAttachmentBlock
                                    fileUrl={m.file_url}
                                    filePath={m.file_path}
                                    fileName={m.file_name}
                                    fileSize={m.file_size}
                                    isImg={isImg}
                                    query={query}
                                  />
                                )}

                                {(mine || isAdmin) && (
                                  <div className="erp-messenger-bubble-actions">
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(m.id, m.file_path)}
                                      className="erp-messenger-bubble-action-btn"
                                      data-armed={confirmDelete.isArmed(m.id) ? "1" : undefined}
                                    >
                                      {confirmDelete.isArmed(m.id) ? "한 번 더 누르면 삭제" : "삭제"}
                                    </button>
                                    {confirmDelete.isArmed(m.id) && (
                                      <button
                                        type="button"
                                        onClick={confirmDelete.reset}
                                        className="erp-messenger-bubble-action-btn"
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
                          <p className="erp-grid-empty erp-u-text-compact">
                            {query ? "검색 결과가 없습니다." : "아직 메시지가 없습니다. 첫 메시지를 남겨보세요."}
                          </p>
                        )}
                        <div ref={listEndRef} />
                      </>
                    )}
                  </div>

                  <div className="erp-messenger-command-bar">
                    {ERP_COMMANDS.map((cmd) => (
                      <button
                        key={cmd.prefix}
                        type="button"
                        className="erp-messenger-command-btn"
                        onClick={() => insertCommand(cmd.prefix)}
                      >
                        <span aria-hidden>{cmd.icon}</span>
                        {cmd.prefix}
                      </button>
                    ))}
                  </div>

                  <form ref={formRef} action={handleSend} className="erp-messenger-composer">
                    <textarea
                      ref={composerRef}
                      name="content"
                      placeholder="메시지 입력 또는 명령어(/) 입력 (Enter: 전송)"
                      rows={2}
                      className="erp-input erp-u-flex-1 erp-u-text-base"
                      style={{ resize: "none" }}
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
                          className="erp-btn erp-u-minw-0 erp-u-text-xs"
                        >
                          그룹 나가기
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={sending}
                        className="erp-btn erp-btn-primary erp-messenger-send-btn"
                        aria-label="전송"
                      >
                        {sending ? (
                          <span className="erp-spinner" aria-hidden />
                        ) : (
                          <span className="erp-icon" style={{ width: 16, height: 16 }} aria-hidden>
                            <SendIcon />
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                  {sendError && (
                    <p className="erp-u-danger erp-u-text-sm" style={{ padding: "0 12px 8px" }}>
                      {sendError}
                    </p>
                  )}
                  {deleteError && (
                    <p className="erp-u-danger erp-u-text-sm" style={{ padding: "0 12px 8px" }}>
                      삭제 실패: {deleteError}
                    </p>
                  )}
                </>
              )}
        </div>
      </div>
    </div>
  );
}



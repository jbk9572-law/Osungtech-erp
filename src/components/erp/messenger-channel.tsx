import type { MessengerChannel } from "@/lib/messenger-types";
import { ChatIcon, GroupIcon } from "@/components/erp/groupware-icons";

// 메신저 채널의 이름표·아바타 — 메신저 화면의 큰 파일에서 분리한 표시용 조각.
export function channelLabel(channel: MessengerChannel, profileNames: Record<string, string>, currentUserId: string): string {
  if (channel.type === "all") return "전체";
  if (channel.type === "group") return channel.name ?? "그룹";
  const otherId = channel.memberIds.find((id) => id !== currentUserId);
  return otherId ? (profileNames[otherId] ?? "구성원") : "DM";
}

// "전체"/그룹 채널은 선 아이콘으로, 1:1 DM은 상대방 이니셜 아바타로
// 보여준다(이모지 👤보다 실제로 누구인지 한눈에 더 잘 들어온다).
export function ChannelAvatar({
  channel,
  profileNames,
  currentUserId,
  size = 20,
}: {
  channel: MessengerChannel;
  profileNames: Record<string, string>;
  currentUserId: string;
  // 사이드바 채널 목록(기본값, 아이콘만)과 대화창 상단 헤더(더 크게)가
  // 같은 컴포넌트를 공유하면서 크기만 다르게 쓴다.
  size?: number;
}) {
  if (channel.type === "all") {
    return (
      <span className="erp-icon erp-u-text" style={{ width: size, height: size }} aria-hidden>
        <ChatIcon />
      </span>
    );
  }
  if (channel.type === "group") {
    return (
      <span className="erp-icon erp-u-text" style={{ width: size, height: size }} aria-hidden>
        <GroupIcon />
      </span>
    );
  }
  const label = channelLabel(channel, profileNames, currentUserId);
  return (
    <span className="erp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }} aria-hidden>
      {label[0] ?? "?"}
    </span>
  );
}

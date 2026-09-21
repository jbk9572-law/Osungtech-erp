"use client";

import { useEffect, useRef } from "react";
import { markMessageRead } from "@/app/(dashboard)/mail/actions";

// 메일 상세를 열면(= 이 컴포넌트가 마운트되면) 딱 한 번 읽음 처리한다.
// 목록 화면 렌더링(서버 컴포넌트) 중에 곧바로 mutation을 부를 수는 없어서
// 클라이언트에서 마운트 시점에 대신 호출한다.
export function MarkAsRead({ messageId, isRead }: { messageId: string; isRead: boolean }) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (isRead || done.current === messageId) return;
    done.current = messageId;
    markMessageRead(messageId, true);
  }, [messageId, isRead]);

  return null;
}

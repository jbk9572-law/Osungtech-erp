"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ShortcutAction = { href: string; newTab?: boolean } | { submitFormSelector: string };

// 목록/상세 페이지(서버 컴포넌트)에 얹어서 F2/F5/F9/ESC 같은 라벨이 실제
// 키 입력에도 반응하게 만드는 컴포넌트. 페이지 자체는 서버 컴포넌트로 두고
// 이 조그만 클라이언트 컴포넌트만 끼워 넣는다.
export function KeyboardShortcuts({
  shortcuts,
}: {
  shortcuts: Partial<Record<string, ShortcutAction>>;
}) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const action = shortcuts[e.key];
      if (!action) return;
      e.preventDefault();
      if ("href" in action) {
        if (action.newTab) {
          window.open(action.href, "_blank", "noopener,noreferrer");
        } else {
          router.push(action.href);
        }
      } else {
        document.querySelector<HTMLFormElement>(action.submitFormSelector)?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, router]);

  return null;
}

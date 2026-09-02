"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { printInPlace } from "@/lib/print-in-place";
import { startRouteProgress } from "@/lib/route-progress";

type ShortcutAction =
  | { href: string; newTab?: boolean }
  | { submitFormSelector: string }
  | { printHref: string };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

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
      // href형(페이지 이동) 단축키는 텍스트 입력 중에 눌러도 그대로
      // 페이지를 나가버려 작성 중이던 내용을 잃을 수 있다 — 예를 들어
      // 메모를 쓰다가 습관적으로 Esc를 누르면 확인 없이 목록으로
      // 튕겨나간다. 저장(F7)·출력은 데이터 손실이 없으니 그대로 둔다.
      if ("href" in action && isEditableTarget(e.target)) return;
      e.preventDefault();
      if ("href" in action) {
        if (action.newTab) {
          window.open(action.href, "_blank", "noopener,noreferrer");
        } else {
          startRouteProgress();
          router.push(action.href);
        }
      } else if ("printHref" in action) {
        printInPlace(action.printHref);
      } else {
        document
          .querySelector<HTMLFormElement>(action.submitFormSelector)
          ?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, router]);

  return null;
}

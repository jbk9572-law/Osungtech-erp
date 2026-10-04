"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { printInPlace } from "@/lib/print-in-place";
import { startRouteProgress } from "@/lib/route-progress";
import { useModalClose, useSetModalCloseHref } from "@/lib/modal-context";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";

type ShortcutAction =
  | { href: string; newTab?: boolean }
  | { submitFormSelector: string }
  | { printHref: string };

// shortcuts prop에 실제로 들어있는 키만, 항상 같은 순서로 라벨링한다 —
// 화면마다 직접 힌트바 문구를 적어주는 대신 여기 한 곳에서만 매핑을
// 관리하면, 새 화면이 KeyboardShortcuts를 쓰는 순간 힌트바도 자동으로
// 따라온다(키 이름과 실제 동작이 어긋날 일이 없다).
const HINT_LABELS: Record<string, string> = {
  F2: "신규",
  F4: "수정",
  F5: "검색",
  F7: "저장",
  F8: "내보내기",
  F9: "인쇄",
  Escape: "닫기",
};
const HINT_ORDER = ["F2", "F4", "F5", "F7", "F8", "F9", "Escape"];

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
  // 모달 안에서 물리 Escape 키가 눌리면 registration-modal-shell.tsx가
  // 이 컴포넌트와 별개로(둘 다 window에 keydown 리스너를 건다) 자기
  // 자신의 close()를 이미 호출한다. 예전엔 여기서도 closeModal()을 또
  // 불러서 같은 keydown 한 번에 close()가 두 번 실행되고, 그 안의
  // router.back()도 두 번 실행되어 히스토리가 의도한 것보다 한 칸 더
  // 넘어가버렸다(모달이 안 닫힌 것처럼 보이거나 엉뚱한 화면으로 튕기는
  // "ESC 두 번 눌러야 닫힘" 류 버그의 실제 원인) — stopPropagation으로는
  // 못 막는다(같은 target인 window에 걸린 리스너끼리는 stopPropagation이
  // 서로를 막지 못하고 stopImmediatePropagation이 필요한데, 두 컴포넌트가
  // 리스너를 등록하는 순서가 마운트 구조에 따라 달라 어느 쪽이 먼저
  // 불릴지 보장할 수 없다). 그래서 모달 안에서는 Escape를 아예 처리하지
  // 않고 registration-modal-shell.tsx에게만 맡긴다.
  const closeModal = useModalClose();
  const setCloseHref = useSetModalCloseHref();

  // 모달 안이면, 이 페이지가 이미 알고 있는 Escape용 href를 모달 셸에
  // 그대로 알려준다 — X 버튼/배경 클릭/ESC로 닫을 때 새로 계산하지 않고
  // 이 값으로 이동하게 하기 위해서다(registration-modal-shell.tsx 참고).
  // 저장 후 닫기(submitFormSelector)처럼 href가 아닌 단축키만 쓰는
  // 페이지는 등록할 값이 없어 셸이 기존 router.back()으로 대체한다.
  useEffect(() => {
    if (!setCloseHref) return;
    const escapeAction = shortcuts.Escape;
    if (escapeAction && "href" in escapeAction) {
      setCloseHref(escapeAction.href);
    }
  }, [shortcuts, setCloseHref]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const action = shortcuts[e.key];
      if (!action) return;
      // href형(페이지 이동) 단축키는 텍스트 입력 중에 눌러도 그대로
      // 페이지를 나가버려 작성 중이던 내용을 잃을 수 있다 — 예를 들어
      // 메모를 쓰다가 습관적으로 Esc를 누르면 확인 없이 목록으로
      // 튕겨나간다. 저장(F7)·출력은 데이터 손실이 없으니 그대로 둔다.
      if ("href" in action && isEditableTarget(e.target)) return;
      if ("href" in action && e.key === "Escape" && closeModal) return;
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
  }, [shortcuts, router, closeModal]);

  const items = HINT_ORDER.filter((key) => shortcuts[key]).map((key) => ({
    key: key === "Escape" ? "Esc" : key,
    label: HINT_LABELS[key],
  }));
  if (items.length === 0) return null;
  return <KeyboardHintBar items={items} />;
}

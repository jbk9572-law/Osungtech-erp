"use client";

import { useEffect, type RefObject } from "react";

// 리본/버튼에 "F7 저장", "F6 삭제"처럼 단축키 라벨을 붙여놓고도 실제 키 입력은
// 무시되던 문제를 고치기 위한 훅. 지정한 키가 눌리면 해당 엘리먼트를 클릭한
// 것과 동일하게 동작시킨다 (form submit의 confirm 등 기존 동작을 그대로 탄다).
//
// 같은 키를 쓰는 폼이 동시에 둘 이상 떠 있을 수 있다(목록 위에 모달, 모달 위에 모달) — 전부 window에서 듣기 때문에
// 그대로 두면 한 번의 키 입력이 아래 화면의 저장까지 같이 눌러 버린다. 같은 키는 "가장 나중에 열린(맨 위) 화면"만 처리한다.
const stacks = new Map<string, symbol[]>();

export function useKeyShortcut(key: string, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const id = Symbol(key);
    const stack = stacks.get(key) ?? [];
    stack.push(id);
    stacks.set(key, stack);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== key) return;
      const current = stacks.get(key);
      if (!current || current[current.length - 1] !== id) return;
      e.preventDefault();
      if (e.repeat) return; // 키를 꾹 눌러도 저장이 여러 번 눌리지 않게
      const el = ref.current;
      if (!el || (el as HTMLButtonElement).disabled) return;
      el.click();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const list = stacks.get(key);
      if (list) {
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);
        if (list.length === 0) stacks.delete(key);
      }
    };
  }, [key, ref]);
}

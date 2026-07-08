import type { KeyboardEvent } from "react";

// 품목을 여러 줄 입력하다가 Enter를 치면 의도치 않게 폼이 통째로 제출되는
// 문제를 막는다. F7 단축키나 등록 버튼 클릭으로만 제출되게 하고, 버튼에
// 포커스가 있을 때의 Enter(=클릭)와 textarea의 줄바꿈은 그대로 둔다.
export function preventEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
  const target = e.target as HTMLElement;
  if (e.key === "Enter" && target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON") {
    e.preventDefault();
  }
}

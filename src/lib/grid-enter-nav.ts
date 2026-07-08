import type { KeyboardEvent } from "react";

// 품목 그리드에서 Enter를 치면 엑셀처럼 같은 열의 바로 아래 행으로 포커스를
// 옮긴다. 마지막 행이면 아무 일도 하지 않는다.
export function focusSameColumnNextRow(e: KeyboardEvent<HTMLTableSectionElement>) {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT") return;

  const cell = target.closest("td");
  const row = cell?.closest("tr");
  if (!cell || !row) return;

  const cellIndex = Array.from(row.children).indexOf(cell);
  const nextRow = row.nextElementSibling;
  const nextCell = nextRow?.children[cellIndex];
  const nextInput = nextCell?.querySelector("input") as HTMLInputElement | null;
  if (nextInput) {
    e.preventDefault();
    nextInput.focus();
    nextInput.select();
  }
}

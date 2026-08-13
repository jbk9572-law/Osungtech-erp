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

// 엑셀처럼 방향키로도 그리드 칸 사이를 이동한다. 위/아래는 같은 열의
// 이전/다음 행으로, 좌/우는 같은 행의 이전/다음 칸으로 옮긴다. 단, 품목
// 검색창은 방향키로 드롭다운 목록을 고르는 데 이미 쓰이고 있어서(그 핸들러가
// preventDefault를 호출하면 이 이벤트도 defaultPrevented가 되므로) 그럴 때는
// 여기서 아무 것도 하지 않고 안쪽 핸들러에게 맡긴다. 좌/우는 입력칸 안에서
// 커서를 옮기는 데도 쓰이므로, 커서가 값의 맨 앞(왼쪽)/맨 뒤(오른쪽)에 있을
// 때만 옆 칸으로 넘어간다.
export function focusGridArrowNav(e: KeyboardEvent<HTMLTableSectionElement>) {
  if (e.defaultPrevented) return;
  const key = e.key;
  if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT") return;
  const input = target as HTMLInputElement;

  const cell = input.closest("td");
  const row = cell?.closest("tr");
  if (!cell || !row) return;

  if (key === "ArrowUp" || key === "ArrowDown") {
    const cellIndex = Array.from(row.children).indexOf(cell);
    const targetRow = key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
    const targetCell = targetRow?.children[cellIndex];
    const targetInput = targetCell?.querySelector("input") as HTMLInputElement | null;
    if (targetInput && !targetInput.disabled) {
      e.preventDefault();
      targetInput.focus();
      targetInput.select();
    }
    return;
  }

  if (input.type === "text") {
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    if (key === "ArrowLeft" && !atStart) return;
    if (key === "ArrowRight" && !atEnd) return;
  }

  let sibling: Element | null = cell;
  while (sibling) {
    sibling = key === "ArrowLeft" ? sibling.previousElementSibling : sibling.nextElementSibling;
    if (!sibling) break;
    const nextInput = sibling.querySelector("input") as HTMLInputElement | null;
    if (nextInput && !nextInput.disabled) {
      e.preventDefault();
      nextInput.focus();
      nextInput.select();
      return;
    }
  }
}

// 품목 검색 드롭다운에서 방향키+Enter로 항목을 고른 직후, 같은 행에서 바로
// 다음으로 입력 가능한 칸(규격이 자동입력이라 비활성화돼 있으면 그다음인
// 수량 등)으로 포커스를 옮긴다.
export function focusNextCellInRow(fromInput: HTMLElement) {
  let cell: Element | null = fromInput.closest("td");
  while (cell) {
    cell = cell.nextElementSibling;
    if (!cell) break;
    const next = cell.querySelector("input, select, textarea") as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    if (next && !next.disabled) {
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
      return;
    }
  }
}

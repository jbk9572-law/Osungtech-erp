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

// 엑셀식 줄 단축키(품목 표 전용) — 표 안 입력칸에서:
//   · Enter  마지막 줄이면 빈 줄을 추가하고 같은 열로 이동(onAppendRow가 true를 돌려줄 때만 — 빈 줄이 무한히 쌓이지 않게 호출부가 판단)
//   · Ctrl+D 바로 위 줄의 같은 열 값을 아래로 채운다(품목 검색칸·비활성 칸은 제외)
//   · Ctrl+Delete 이 줄을 삭제(줄 끝의 삭제 버튼을 그대로 누른다 — 마지막 한 줄이면 버튼이 꺼져 있어 아무 일도 없다)
//   · Ctrl+Z / Ctrl+Y(Ctrl+Shift+Z) 줄 추가·삭제·채우기·값 수정을 되돌리기/다시 실행(onUndo/onRedo를 넘긴 폼만)
// 매출/매입/할일 품목 표가 같이 쓴다. Enter의 "아래 칸 이동"은 focusSameColumnNextRow가 먼저 처리한다.
// 줄이 사라지는 동작(되돌리기·줄 삭제) 직전에 "몇 번째 줄·몇 번째 칸에 포커스가 있었는지" 기억해 두고,
// 동작 뒤 포커스가 표 밖으로 빠졌으면 가까운 줄의 같은 칸으로 되돌려 주는 함수를 돌려준다.
// 포커스가 표 밖(문서 맨 위)으로 빠지면 이어지는 Ctrl+Z / Ctrl+Y 키가 표에 전달되지 않는다.
function rememberGridFocus(tbody: HTMLTableSectionElement, target: HTMLElement): () => void {
  const rowBefore = target.closest("tr");
  const rowIndex = rowBefore ? Array.from(tbody.rows).indexOf(rowBefore as HTMLTableRowElement) : 0;
  const cellBefore = target.closest("td");
  const colIndex = cellBefore && rowBefore ? Array.from(rowBefore.children).indexOf(cellBefore) : 0;
  return () =>
    setTimeout(() => {
      if (tbody.contains(document.activeElement)) return;
      const row = tbody.rows[Math.min(Math.max(rowIndex, 0), tbody.rows.length - 1)];
      const input = (row?.children[colIndex]?.querySelector("input:not(:disabled)") ?? row?.querySelector("input:not(:disabled)")) as HTMLInputElement | null;
      input?.focus();
    }, 0);
}

export function focusGridRowShortcuts(
  e: KeyboardEvent<HTMLTableSectionElement>,
  opts: { onAppendRow?: () => boolean; onUndo?: () => boolean; onRedo?: () => boolean } = {},
) {
  // Ctrl+Z 되돌리기 / Ctrl+Y(또는 Ctrl+Shift+Z) 다시 실행 — 표 안 어디에 포커스가 있든(삭제 버튼을 누른 직후 포함) 줄 상태 기록을 되돌린다.
  // 되돌릴 것이 없으면 브라우저 기본 동작(칸 안 글자 되돌리기)을 막지 않는다.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (opts.onUndo || opts.onRedo)) {
    const k = e.key.toLowerCase();
    const redo = k === "y" || (k === "z" && e.shiftKey);
    const undo = k === "z" && !e.shiftKey;
    // 되돌리기로 지금 포커스가 있던 줄이 사라질 수 있다 — 그러면 포커스가 문서 맨 위로 빠져 다음 Ctrl+Z가 표에 전달되지 않는다.
    const restoreFocus = rememberGridFocus(e.currentTarget, e.target as HTMLElement);
    if ((undo && opts.onUndo?.()) || (redo && opts.onRedo?.())) {
      e.preventDefault();
      restoreFocus();
      return;
    }
  }
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT") return;
  const input = target as HTMLInputElement;
  const cell = input.closest("td");
  const row = cell?.closest("tr");
  if (!cell || !row) return;
  const cellIndex = Array.from(row.children).indexOf(cell);

  if (e.key === "Enter" && !e.defaultPrevented && opts.onAppendRow) {
    const nextInput = row.nextElementSibling?.children[cellIndex]?.querySelector("input");
    if (nextInput || !opts.onAppendRow()) return;
    e.preventDefault();
    setTimeout(() => {
      const created = row.nextElementSibling;
      const sameCol = created?.children[cellIndex]?.querySelector("input:not(:disabled)") as HTMLInputElement | null;
      const first = created?.querySelector("input:not(:disabled)") as HTMLInputElement | null;
      (sameCol ?? first)?.focus();
    }, 0);
    return;
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
    e.preventDefault();
    const source = row.previousElementSibling?.children[cellIndex]?.querySelector("input") as HTMLInputElement | null;
    if (!source || input.disabled || input.readOnly || input.getAttribute("role") === "combobox" || input.hasAttribute("aria-autocomplete")) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, source.value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Delete") {
    const remove = row.querySelector('button[aria-label="이 줄 삭제"]') as HTMLButtonElement | null;
    if (remove && !remove.disabled) {
      e.preventDefault();
      const restoreFocus = rememberGridFocus(e.currentTarget, input);
      remove.click();
      restoreFocus();
    }
  }
}

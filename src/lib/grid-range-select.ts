// 표에서 "칸 범위 선택"을 화면 좌표로 계산한다.
// 예전엔 칸 번호(몇 번째 줄·몇 번째 칸)로 범위를 잡았는데, 표가 <tbody>를 여러 개 갖거나(매출의 전월 이월분 묶음) 칸이 합쳐진 줄(colSpan: 이월 소계·구역 제목)이 있으면
// 번호가 화면과 어긋나 마우스가 올라간 곳이 아닌 엉뚱한 칸이 선택됐다. 지금은 ① 모든 tbody의 줄을 한 줄로 이어서 세고 ② 가로 범위는 칸의 실제 위치(x)로 정한다.

export type CellRef = { table: HTMLTableElement; row: HTMLTableRowElement; cell: HTMLTableCellElement };

export function cellRefAt(el: EventTarget | null, selector: string): CellRef | null {
  const cell = (el as HTMLElement | null)?.closest?.(selector) as HTMLTableCellElement | null;
  const row = cell?.parentElement as HTMLTableRowElement | null;
  const table = cell?.closest("table") as HTMLTableElement | null;
  if (!cell || !row || !table) return null;
  return { table, row, cell };
}

/** 표의 모든 본문 줄(tbody 여러 개여도 화면 순서대로 한 줄로). */
export function dataRowsOf(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr"));
}

const centerX = (el: Element) => {
  const b = el.getBoundingClientRect();
  return (b.left + b.right) / 2;
};

/** 칸이 합쳐진 줄(구역 제목·소계)은 데이터 줄이 아니다 — 범위에서 뺀다. */
function isDataRow(tr: HTMLTableRowElement): boolean {
  return Array.from(tr.cells).every((td) => td.colSpan === 1);
}

/** 시작 칸과 끝 칸 사이의 사각형에 들어오는 칸들 — 줄마다 한 묶음. 보이지 않는 칸·합쳐진 줄은 뺀다. */
export function cellsInRange(a: CellRef, b: CellRef): HTMLTableCellElement[][] {
  if (a.table !== b.table) return [];
  const rows = dataRowsOf(a.table);
  const ia = rows.indexOf(a.row);
  const ib = rows.indexOf(b.row);
  if (ia < 0 || ib < 0) return [];
  const ra = a.cell.getBoundingClientRect();
  const rb = b.cell.getBoundingClientRect();
  const x1 = Math.min(ra.left, rb.left);
  const x2 = Math.max(ra.right, rb.right);
  const out: HTMLTableCellElement[][] = [];
  for (const tr of rows.slice(Math.min(ia, ib), Math.max(ia, ib) + 1)) {
    if (!tr.offsetParent || !isDataRow(tr)) continue;
    const cells = Array.from(tr.cells).filter((td) => {
      if (!td.offsetParent) return false;
      const cx = centerX(td);
      return cx >= x1 && cx <= x2;
    });
    if (cells.length) out.push(cells);
  }
  return out;
}

/** 이 가로 위치(x)를 지나는 머리글 칸 — 마지막 머리글 줄에서 찾는다. */
export function headerCellAtX(table: HTMLTableElement, x: number): HTMLTableCellElement | null {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return null;
  return (Array.from(headRow.cells).find((th) => {
    const b = th.getBoundingClientRect();
    return x >= b.left && x <= b.right;
  }) ?? null) as HTMLTableCellElement | null;
}

/** 줄 안에서 이 가로 위치(x)를 지나는 한 칸짜리 칸. */
export function cellAtX(row: HTMLTableRowElement, x: number): HTMLTableCellElement | null {
  return (Array.from(row.cells).find((td) => {
    if (td.colSpan !== 1) return false;
    const b = td.getBoundingClientRect();
    return x >= b.left && x <= b.right;
  }) ?? null) as HTMLTableCellElement | null;
}

export const cellCenterX = centerX;

/** 칸의 복사용 글자 — 입력칸이면 값, data-copy-text 가 있으면 그것(화면에는 줄여 보여도 복사에는 전부 담는다), 아니면 보이는 글자(버튼 제외). */
export function cellText(td: HTMLTableCellElement | null | undefined): string {
  if (!td) return "";
  const input = td.querySelector('input:not([type="checkbox"]):not([type="hidden"])') as HTMLInputElement | null;
  if (input) return input.value;
  if (td.dataset.copyText) return td.dataset.copyText;
  const clone = td.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

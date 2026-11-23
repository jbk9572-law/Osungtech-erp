// 목록 표에서 "지금 고른 행이 몇 번째 / 전체 몇 행"인지 계산한다(하단 상태줄용).
// 계산은 순수 함수(positionOfRows)로 두고, DOM에서 행 정보를 모으는 얇은 어댑터만 따로 둔다.
export type GridRowPosition = { index: number; total: number };
export type GridRowInfo = { cells: number; active: boolean };

/** 칸이 하나뿐인 줄(안내·펼침 줄)은 행으로 세지 않는다. 고른 행이 없으면 index는 0, 행이 없으면 null. */
export function positionOfRows(rows: GridRowInfo[]): GridRowPosition | null {
  const dataRows = rows.filter((r) => r.cells > 1);
  if (dataRows.length === 0) return null;
  return { index: dataRows.findIndex((r) => r.active) + 1, total: dataRows.length };
}

export function findGridRowPosition(root: ParentNode | null): GridRowPosition | null {
  const table = root?.querySelector("table.erp-grid");
  if (!table) return null;
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody > tr")).map((tr) => ({
    cells: tr.cells.length,
    active: tr.classList.contains("master-active") || tr.classList.contains("selected"),
  }));
  return positionOfRows(rows);
}

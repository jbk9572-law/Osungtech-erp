// 거래명세표 A형(엔택스 A형 서식) 칸 위치 단일 소스.
// 원본 PDF(거래명세표A형기본)의 실제 선 좌표를 pt 단위로 실측한 값이다 — pdftocairo -svg 로 선(path)을 뽑아 변환 행렬을 적용해 얻었다.
// A형은 B형과 칸 너비가 달라서(월일 30pt vs 34pt 등) B형의 34칸 격자를 재사용하면 위치가 어긋난다 → 별도 격자로 둔다.
// 컴포넌트는 "x 좌표 범위"만 말하면 되고, 칸 수(colSpan)와 너비(%)는 여기서 계산한다(숫자를 컴포넌트에 흩어 두지 않는다).

// 표 가로 범위: 44.4pt ~ 559.7pt (용지 A4 595.44pt 기준).
export const A_BOUNDS_PT = [
  44.4, 59.3, 72.8, 74.3, 100.5, 167.2, 182.2, 210.9, 214.2, 220.4, 229.1, 249.6, 252.9, 263.8, 302.0, 305.0, 317.0, 329.0,
  358.2, 363.5, 403.9, 418.2, 426.4, 433.9, 449.6, 468.6, 471.8, 486.8, 498.3, 501.8, 510.5, 531.3, 559.7,
] as const;

const TOLERANCE = 0.15;

function indexOfBound(x: number): number {
  const i = A_BOUNDS_PT.findIndex((b) => Math.abs(b - x) <= TOLERANCE);
  if (i < 0) throw new Error(`A형 격자에 없는 x 좌표: ${x}`);
  return i;
}

// x0~x1 구간이 격자 몇 칸인가 (colSpan).
export function aSpan(x0: number, x1: number): number {
  return indexOfBound(x1) - indexOfBound(x0);
}

// 각 격자 칸의 너비(%, 합계 100) — <colgroup>에 그대로 넣는다.
export function aColWidthsPct(): number[] {
  const total = A_BOUNDS_PT[A_BOUNDS_PT.length - 1] - A_BOUNDS_PT[0];
  return A_BOUNDS_PT.slice(1).map((b, i) => ((b - A_BOUNDS_PT[i]) / total) * 100);
}

// 줄 높이(px) — 원본 실측 pt × 4/3.
export const A_ROW = {
  header1: 22.7,
  header2: 22.5,
  party1: 22.7,
  party2: 27.9,
  party3: 28,
  party4: 28,
  itemHead: 18.8,
  item: 29.7,
  total: 26.4,
  memo: 30,
};

// 원본은 품목 줄이 8줄이다(B형은 10줄).
export const A_DEFAULT_ITEM_ROWS = 8;

export const A_FONT = {
  label: 12,
  body: 12,
  name: 13,
  number: 16,
  stamp: 9.3,
  title: 27,
  copyLabel: 11,
  assignee: 10.75,
};

// 공급자(왼쪽 절반) / 공급받는자(오른쪽 절반)의 칸 x 범위 — 두 절반은 구조가 같고 위치만 다르다.
export type APartySide = {
  r1: { label: [number, number]; number: [number, number]; sub: [number, number]; blank: [number, number] };
  r2: { label: [number, number]; name: [number, number]; repLabel: [number, number]; rep: [number, number] };
  r3: { label: [number, number]; value: [number, number] };
  r4: { l1: [number, number]; v1: [number, number]; l2: [number, number]; v2: [number, number] };
};

export const A_LEFT: APartySide = {
  r1: { label: [44.4, 100.5], number: [100.5, 210.9], sub: [210.9, 252.9], blank: [252.9, 302.0] },
  r2: { label: [44.4, 59.3], name: [59.3, 214.2], repLabel: [214.2, 229.1], rep: [229.1, 302.0] },
  r3: { label: [44.4, 59.3], value: [59.3, 302.0] },
  r4: { l1: [44.4, 59.3], v1: [59.3, 167.2], l2: [167.2, 182.2], v2: [182.2, 302.0] },
};

export const A_RIGHT: APartySide = {
  r1: { label: [302.0, 358.2], number: [358.2, 468.6], sub: [468.6, 510.5], blank: [510.5, 559.7] },
  r2: { label: [302.0, 317.0], name: [317.0, 471.8], repLabel: [471.8, 486.8], rep: [486.8, 559.7] },
  r3: { label: [302.0, 317.0], value: [317.0, 559.7] },
  // 오른쪽 4행은 업태/종목이 아니라 비고/인수자
  r4: { l1: [302.0, 317.0], v1: [317.0, 471.8], l2: [471.8, 501.8], v2: [501.8, 559.7] },
};

export const A_HEADER = {
  title: [44.4, 249.6] as [number, number],
  copyLabel: [249.6, 302.0] as [number, number],
  dateLabel: [302.0, 329.0] as [number, number],
  date: [329.0, 403.9] as [number, number],
  noLabel: [403.9, 426.4] as [number, number],
  no: [426.4, 531.3] as [number, number],
  page: [531.3, 559.7] as [number, number],
  rest: [302.0, 559.7] as [number, number],
  // 제목 글자가 칸 중앙이 아니라 약간 오른쪽에 찍힌다(원본 실측: 칸 중앙보다 17.3pt 오른쪽).
  titleOffsetPx: 23,
};

// 품목 표 열(월일/품명·규격/단위/수량/단가/공급가액/세액/비고·합계)
export const A_ITEM_COLS: [number, number][] = [
  [44.4, 74.3],
  [74.3, 220.4],
  [220.4, 263.8],
  [263.8, 305.0],
  [305.0, 363.5],
  [363.5, 433.9],
  [433.9, 498.3],
  [498.3, 559.7],
];

export const A_SUMMARY = {
  label: [44.4, 72.8] as [number, number],
  value: [72.8, 418.2] as [number, number],
  balLabel: [418.2, 449.6] as [number, number],
  balValue: [449.6, 559.7] as [number, number],
};

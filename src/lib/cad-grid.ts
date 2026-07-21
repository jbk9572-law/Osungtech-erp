// 캐드 도면처럼 원지 배치도에 격자선/눈금자를 그리기 위한 공용 계산 로직.
// 모조지계산(BatchCard)과 재단 배치 시뮬레이터(ManualLayoutClient)가 함께 쓴다.
export type CadGridLine = { x1: number; y1: number; x2: number; y2: number; major: boolean };

export function computeCadGridLines(paperW: number, paperH: number): CadGridLine[] {
  const step = 50;
  const lines: CadGridLine[] = [];
  for (let x = step; x < paperW; x += step) {
    lines.push({ x1: x, y1: 0, x2: x, y2: paperH, major: x % 100 === 0 });
  }
  for (let y = step; y < paperH; y += step) {
    lines.push({ x1: 0, y1: y, x2: paperW, y2: y, major: y % 100 === 0 });
  }
  return lines;
}

export function computeCadRulerTicks(length: number): number[] {
  return Array.from({ length: Math.floor(length / 100) }, (_, i) => (i + 1) * 100);
}

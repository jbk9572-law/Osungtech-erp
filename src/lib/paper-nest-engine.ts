// 모조지(원지) 재단 계산 엔진 — Cutting Stock 방식.
// Paper Nesting Pro(Streamlit/Python) 버전의 engine.py를 그대로 이식한 것.
// 1) 품목 조합(1~3종류)마다 "가장 채움률 좋은 배치 패턴"을 미리 만든다
// 2) 그 패턴들을 그리디(욕심쟁이)로 반복 사용해서 발주량을 채운다
// 원지는 항상 500장(1연) 단위로만 사용한다 — 재단기를 다시 세팅하지 않고
// 한 번에 쌓아 자르는 실제 인쇄소 작업 방식과 맞춰야 하기 때문.

export type Item = {
  name: string;
  width: number;
  height: number;
  orderQty: number;
};

type Placement = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
};

type FreeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Pattern = {
  placements: Placement[];
  counts: Record<string, number>;
  coveredArea: number;
};

export type NestLayoutItem = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  prod: number;
  color: string;
};

export type NestLayout = {
  paperW: number;
  paperH: number;
  items: NestLayoutItem[];
  margin: { usage: number; right: number; bottom: number; area: number };
  sheetCount: number;
  batchReams: number;
};

export type NestResult = {
  totalPaper: number;
  totalSheet: number;
  totalProd: number;
  overProd: number;
  layouts: NestLayout[];
  fulfilled: boolean;
  remaining: Record<string, number>;
};

// 범례/도면 색상을 엔진에서 한 번만 정해서 내려준다 (화면·인쇄 색상이 어긋나지 않도록).
const PALETTE = [
  "#7CB5EC",
  "#90ED7D",
  "#F7A35C",
  "#8085E9",
  "#F15C80",
  "#91E8E1",
  "#B2DF8A",
  "#FDB462",
  "#80B1D3",
  "#FB8072",
];

function placementSortKey(p: Placement): string {
  return `${p.name}|${p.x}|${p.y}|${p.width}|${p.height}|${p.rotated}`;
}

function candidateKey(candidate: Placement[]): string {
  return [...candidate]
    .sort((a, b) => a.x - b.x || a.y - b.y || a.name.localeCompare(b.name) || Number(a.rotated) - Number(b.rotated))
    .map(placementSortKey)
    .join(";");
}

export class NestEngine {
  sheetWidth = 788;
  sheetHeight = 1091;
  // 원지 1연 = 500장
  sheetPerReam = 500;
  // 원지 안쪽 여백(재단 여유). 기본 0mm.
  marginMm = 0;

  private items: Item[] = [];

  calculate(items: Item[]): NestResult {
    this.items = items;

    if (items.length === 0) return this.emptyReport();

    const remaining: Record<string, number> = {};
    for (const item of items) remaining[item.name] = item.orderQty;

    const combinations = this.generateCombinations(items);
    const patterns = this.buildPatterns(combinations);

    if (patterns.length === 0) {
      // 어떤 품목도 원지 안에 들어가지 않는 경우 (치수 오류 등)
      return this.emptyReport(remaining);
    }

    // Cutting Stock 그리디 탐색: 원지를 한 장씩 쌓지 않고 "이 패턴을 몇 장
    // 썼는지"만 누적한다. 같은 패턴이 수천 번 반복돼도 결과에는 "패턴 1개 +
    // 사용 장수"로만 남는다.
    const patternUsage = new Map<Pattern, number>();
    let overProduction = 0;
    let totalSheetsUsed = 0;
    const safetyLimit = this.safetySheetLimit(items);

    while (Object.values(remaining).some((qty) => qty > 0)) {
      if (totalSheetsUsed >= safetyLimit) {
        // 이론상 도달하면 안 되는 상황(무한루프 방지용 안전장치)
        break;
      }

      const pattern = this.selectBestPattern(patterns, remaining);
      if (!pattern) break;

      // 패턴 하나를 선택하면 무조건 500장(1연) 단위로 사용한다. 재단 세팅을
      // 한 번 하면 최소 1연은 채워야 실제 인쇄소 운영과 맞기 때문에, 남으면
      // 초과생산으로 처리한다.
      const reps = this.sheetPerReam;

      patternUsage.set(pattern, (patternUsage.get(pattern) ?? 0) + reps);
      totalSheetsUsed += reps;

      for (const [name, count] of Object.entries(pattern.counts)) {
        if (count <= 0) continue;
        const totalNeeded = count * reps;
        const rem = remaining[name] ?? 0;
        const used = Math.min(totalNeeded, rem);
        remaining[name] = rem - used;
        if (totalNeeded > used) overProduction += totalNeeded - used;
      }
    }

    const fulfilled = Object.values(remaining).every((qty) => qty <= 0);

    const batches: [Pattern, number][] = Array.from(patternUsage.entries()).filter(
      ([, count]) => count > 0
    );

    return this.buildReport(batches, totalSheetsUsed, overProduction, fulfilled, remaining);
  }

  private findAllPositions(rect: FreeRect, item: Item): Placement[] {
    const positions: Placement[] = [];

    if (item.width <= rect.width && item.height <= rect.height) {
      positions.push({
        name: item.name,
        x: rect.x,
        y: rect.y,
        width: item.width,
        height: item.height,
        rotated: false,
      });
    }

    if (item.width !== item.height && item.height <= rect.width && item.width <= rect.height) {
      positions.push({
        name: item.name,
        x: rect.x,
        y: rect.y,
        width: item.height,
        height: item.width,
        rotated: true,
      });
    }

    return positions;
  }

  private splitRect(freeRect: FreeRect, placement: Placement): FreeRect[] {
    const result: FreeRect[] = [];
    const { x: fx, y: fy, width: fw, height: fh } = freeRect;
    const { x: px, y: py, width: pw, height: ph } = placement;

    if (px >= fx + fw || px + pw <= fx || py >= fy + fh || py + ph <= fy) {
      return [freeRect];
    }

    if (px > fx) {
      result.push({ x: fx, y: fy, width: px - fx, height: fh });
    }

    const right = px + pw;
    if (right < fx + fw) {
      result.push({ x: right, y: fy, width: fx + fw - right, height: fh });
    }

    if (py > fy) {
      const left = Math.max(fx, px);
      const right2 = Math.min(fx + fw, px + pw);
      if (right2 > left) {
        result.push({ x: left, y: fy, width: right2 - left, height: py - fy });
      }
    }

    const bottom = py + ph;
    if (bottom < fy + fh) {
      const left = Math.max(fx, px);
      const right2 = Math.min(fx + fw, px + pw);
      if (right2 > left) {
        result.push({ x: left, y: bottom, width: right2 - left, height: fy + fh - bottom });
      }
    }

    return result;
  }

  private removeDuplicateRects(freeRects: FreeRect[]): FreeRect[] {
    const unique: FreeRect[] = [];
    const visited = new Set<string>();

    for (const rect of freeRects) {
      const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
      if (visited.has(key)) continue;
      visited.add(key);
      unique.push(rect);
    }

    const result: FreeRect[] = [];
    for (let i = 0; i < unique.length; i++) {
      const current = unique[i];
      let included = false;
      for (let j = 0; j < unique.length; j++) {
        if (i === j) continue;
        const other = unique[j];
        if (
          current.x >= other.x &&
          current.y >= other.y &&
          current.x + current.width <= other.x + other.width &&
          current.y + current.height <= other.y + other.height
        ) {
          included = true;
          break;
        }
      }
      if (!included) result.push(current);
    }

    return result;
  }

  private placeRect(freeRects: FreeRect[], targetRect: FreeRect, placement: Placement): FreeRect[] {
    const next = freeRects.filter((r) => r !== targetRect);
    next.push(...this.splitRect(targetRect, placement));
    return this.removeDuplicateRects(next);
  }

  private generateCombinations(items: Item[]): Item[][] {
    const combinations: Item[][] = [];
    const n = items.length;

    for (let i = 0; i < n; i++) combinations.push([items[i]]);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) combinations.push([items[i], items[j]]);
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) combinations.push([items[i], items[j], items[k]]);
      }
    }

    return combinations;
  }

  // DFS 탐색으로 Layout 후보를 생성한다. deadline(Date.now() 기준 ms)을
  // 넘기면 즉시 중단한다 — 작은 품목이 섞이면 자리 수가 폭발적으로 늘어나서
  // 재귀 호출 횟수만 제한해서는 시간을 못 막기 때문에, 실제 걸린 시간으로 막는다.
  private searchLayout(
    combination: Item[],
    freeRects: FreeRect[],
    placements: Placement[],
    layoutBuffer: Placement[][],
    seenKeys: Set<string>,
    hardLimit: number,
    deadline: number
  ) {
    if (Date.now() > deadline) return;
    if (layoutBuffer.length >= hardLimit) return;

    let anyPossible = false;
    for (const rect of freeRects) {
      for (const item of combination) {
        if (this.findAllPositions(rect, item).length > 0) {
          anyPossible = true;
          break;
        }
      }
      if (anyPossible) break;
    }

    if (!anyPossible) {
      this.storeCandidate(placements, layoutBuffer, seenKeys, hardLimit);
      return;
    }

    for (const rect of [...freeRects]) {
      for (const item of combination) {
        const positions = this.findAllPositions(rect, item);
        if (positions.length === 0) continue;

        const geometryKey = (p: Placement): [number, number, number, number, number] => {
          const remainW = rect.width - p.width;
          const remainH = rect.height - p.height;
          const shortSide = Math.min(remainW, remainH);
          const longSide = Math.max(remainW, remainH);
          return [-(p.width * p.height), shortSide, longSide, p.y, p.x];
        };

        const sortedPositions = [...positions].sort((a, b) => {
          const ka = geometryKey(a);
          const kb = geometryKey(b);
          for (let i = 0; i < ka.length; i++) {
            if (ka[i] !== kb[i]) return ka[i] - kb[i];
          }
          return 0;
        });

        for (const pos of sortedPositions) {
          if (Date.now() > deadline) return;

          const nextFreeRects = this.placeRect(freeRects, rect, pos);
          const nextPlacements = [...placements, pos];

          this.storeCandidate(nextPlacements, layoutBuffer, seenKeys, hardLimit);

          this.searchLayout(
            combination,
            nextFreeRects,
            nextPlacements,
            layoutBuffer,
            seenKeys,
            hardLimit,
            deadline
          );
        }
      }
    }
  }

  private storeCandidate(
    candidate: Placement[],
    layoutBuffer: Placement[][],
    seenKeys: Set<string>,
    hardLimit: number
  ) {
    if (layoutBuffer.length >= hardLimit) return;
    if (candidate.length === 0) return;

    const key = candidateKey(candidate);
    if (seenKeys.has(key)) return;

    seenKeys.add(key);
    layoutBuffer.push([...candidate]);
  }

  // 단일 품목 조합은 DFS 없이 격자 배치를 바로 계산한다. 시간이 전혀 안
  // 걸리고, 모든 품목이 최소 1개의 패턴은 반드시 갖게 되어 "시간 예산 안에
  // 후보가 안 만들어져서 계속 발주 미달로 남는" 상황을 원천 차단한다.
  private buildSingleItemPattern(item: Item): Pattern | null {
    const m = this.marginMm;
    const usableW = this.sheetWidth - m * 2;
    const usableH = this.sheetHeight - m * 2;
    if (usableW <= 0 || usableH <= 0) return null;

    let best: { count: number; w: number; h: number; rotated: boolean; cols: number; rows: number } | null = null;

    for (const rotated of [false, true]) {
      const w = rotated ? item.height : item.width;
      const h = rotated ? item.width : item.height;
      if (w <= 0 || h <= 0 || w > usableW || h > usableH) continue;
      const cols = Math.floor(usableW / w);
      const rows = Math.floor(usableH / h);
      const count = cols * rows;
      if (count <= 0) continue;
      if (!best || count > best.count) best = { count, w, h, rotated, cols, rows };
    }

    if (!best) return null;

    const { count, w, h, rotated, cols, rows } = best;
    const placements: Placement[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        placements.push({ name: item.name, x: m + c * w, y: m + r * h, width: w, height: h, rotated });
      }
    }

    return {
      placements,
      counts: { [item.name]: count },
      coveredArea: w * h * count,
    };
  }

  private buildPatterns(combinations: Item[][]): Pattern[] {
    const patterns: Pattern[] = [];

    // 단일 품목 조합은 시간 예산과 무관하게 먼저 전부 처리한다.
    for (const combo of combinations) {
      if (combo.length === 1) {
        const pattern = this.buildSingleItemPattern(combo[0]);
        if (pattern) patterns.push(pattern);
      }
    }

    // 조합 전체(최대 175개까지 가능)에 대한 총 시간 상한. 콤보별로 0.8초씩
    // 걸려도 품목이 10개면 최악의 경우 2분 넘게 걸릴 수 있어서, 전체 예산을
    // 넘기면 남은 조합은 건너뛴다.
    const globalDeadline = Date.now() + 5000;

    for (const combo of combinations) {
      if (combo.length === 1) continue;
      if (Date.now() > globalDeadline) break;

      const layoutBuffer: Placement[][] = [];
      const seenKeys = new Set<string>();
      const m = this.marginMm;
      const usableW = this.sheetWidth - m * 2;
      const usableH = this.sheetHeight - m * 2;
      if (usableW <= 0 || usableH <= 0) continue;

      this.searchLayout(
        combo,
        [{ x: m, y: m, width: usableW, height: usableH }],
        [],
        layoutBuffer,
        seenKeys,
        200,
        Date.now() + 800
      );

      if (layoutBuffer.length === 0) continue;

      // 커버 면적이 큰 순으로 정렬한 뒤 "품목별 개수 비율"이 서로 다른 상위
      // 후보를 최대 4개까지 남긴다. 최적 패턴 1개만 쓰면 발주량이 그 패턴의
      // 배수로 딱 안 떨어질 때 남는 자투리를 처리할 대안이 없어서 낭비가 커진다.
      const sortedCandidates = [...layoutBuffer].sort(
        (a, b) =>
          b.reduce((sum, p) => sum + p.width * p.height, 0) -
          a.reduce((sum, p) => sum + p.width * p.height, 0)
      );

      const seenRatios = new Set<string>();
      let kept = 0;
      for (const candidate of sortedCandidates) {
        if (candidate.length === 0 || kept >= 4) break;

        const counts: Record<string, number> = {};
        for (const p of candidate) counts[p.name] = (counts[p.name] ?? 0) + 1;

        const ratioKey = Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, count]) => `${name}:${count}`)
          .join(",");
        if (seenRatios.has(ratioKey)) continue;
        seenRatios.add(ratioKey);

        const covered = candidate.reduce((sum, p) => sum + p.width * p.height, 0);
        if (covered <= 0) continue;

        patterns.push({ placements: candidate, counts, coveredArea: covered });
        kept += 1;
      }
    }

    return patterns;
  }

  // 지금 남아있는 발주량 기준으로 "가장 도움이 되는" 패턴을 고른다 (그
  // 패턴을 썼을 때 실제로 필요한 만큼만 인정해서 점수를 매겨, 이미 다 채운
  // 품목만 잔뜩 만드는 패턴은 낮은 점수를 받는다).
  private selectBestPattern(patterns: Pattern[], remaining: Record<string, number>): Pattern | null {
    const nameToItem = new Map(this.items.map((item) => [item.name, item]));
    const sheetArea = this.sheetWidth * this.sheetHeight;

    let bestPattern: Pattern | null = null;
    let bestScore = -1;

    for (const pattern of patterns) {
      let usefulArea = 0;
      let anyNeeded = false;

      for (const [name, count] of Object.entries(pattern.counts)) {
        const rem = remaining[name] ?? 0;
        if (rem <= 0) continue;
        anyNeeded = true;
        const item = nameToItem.get(name);
        if (!item) continue;
        const usefulCount = Math.min(count, rem);
        usefulArea += usefulCount * item.width * item.height;
      }

      if (!anyNeeded) continue;

      const score = sheetArea ? usefulArea / sheetArea : 0;
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    return bestPattern;
  }

  // 무한루프 방지용 상한 (면적 기준 이론적 최소치의 넉넉한 배수)
  private safetySheetLimit(items: Item[]): number {
    const totalArea = items.reduce((sum, item) => sum + item.width * item.height * item.orderQty, 0);
    const sheetArea = this.sheetWidth * this.sheetHeight;
    if (sheetArea <= 0) return 0;
    const lowerBound = Math.ceil(totalArea / sheetArea);
    return Math.max(lowerBound * 3 + 100, 1000);
  }

  private buildColorMap(items: Item[]): Record<string, string> {
    const colorMap: Record<string, string> = {};
    items.forEach((item, i) => {
      colorMap[item.name] = PALETTE[i % PALETTE.length];
    });
    return colorMap;
  }

  private buildReport(
    batches: [Pattern, number][],
    totalSheets: number,
    overProduction: number,
    fulfilled: boolean,
    remaining: Record<string, number>
  ): NestResult {
    const colorMap = this.buildColorMap(this.items);
    const sheetArea = this.sheetWidth * this.sheetHeight;

    const layouts: NestLayout[] = [];
    let totalProd = 0;

    // 사용 장수가 많은 배치부터 보여준다 (주력 패턴을 먼저 확인하도록)
    const sortedBatches = [...batches].sort((a, b) => b[1] - a[1]);

    for (const [pattern, sheetCount] of sortedBatches) {
      const { placements, coveredArea: covered } = pattern;
      const usage = sheetArea ? Math.round((covered / sheetArea) * 100 * 100) / 100 : 0;

      const rightExtent = placements.length ? Math.max(...placements.map((p) => p.x + p.width)) : 0;
      const bottomExtent = placements.length ? Math.max(...placements.map((p) => p.y + p.height)) : 0;
      const rightMargin = Math.max(this.sheetWidth - rightExtent, 0);
      const bottomMargin = Math.max(this.sheetHeight - bottomExtent, 0);
      const wasteArea = Math.max(sheetArea - covered, 0);

      const batchReamsExact = this.sheetPerReam ? sheetCount / this.sheetPerReam : 0;

      const itemsOut: NestLayoutItem[] = placements.map((p) => ({
        name: p.name,
        x: p.x,
        y: p.y,
        w: p.width,
        h: p.height,
        // 이 자리 하나가 배치 전체에서 몇 장 나오는지 (사각형 1개 x 반복 횟수)
        prod: sheetCount,
        color: colorMap[p.name] ?? "#CCCCCC",
      }));

      totalProd += placements.length * sheetCount;

      layouts.push({
        paperW: this.sheetWidth,
        paperH: this.sheetHeight,
        items: itemsOut,
        margin: { usage, right: rightMargin, bottom: bottomMargin, area: wasteArea },
        sheetCount,
        batchReams: Math.round(batchReamsExact * 100) / 100,
      });
    }

    const totalReams = totalSheets ? Math.ceil(totalSheets / this.sheetPerReam) : 0;

    return {
      totalPaper: totalSheets,
      totalSheet: totalReams,
      totalProd,
      overProd: overProduction,
      layouts,
      fulfilled,
      remaining,
    };
  }

  private emptyReport(remaining?: Record<string, number>): NestResult {
    return {
      totalPaper: 0,
      totalSheet: 0,
      totalProd: 0,
      overProd: 0,
      layouts: [],
      fulfilled: false,
      remaining: remaining ?? {},
    };
  }
}

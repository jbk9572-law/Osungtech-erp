// 모조지(원지) 재단 계산 엔진 — Cutting Stock 방식.
// Paper Nesting Pro(Streamlit/Python) 버전의 engine.py를 그대로 이식한 것.
// 1) 품목 조합(1~3종류)마다 "가장 채움률 좋은 배치 패턴"을 미리 만든다
// 2) 그 패턴들을 그리디(욕심쟁이)로 반복 사용해서 발주량을 채운다
// 3) (마무리 패스) 품목이 하나씩 다 채워져서 남은 품목 구성이 바뀔 때마다,
//    그 순간 남은 품목들만 가지고 배치를 새로 탐색해 후보에 추가한다 —
//    처음부터 만들어둔 패턴만으로는 발주 막바지에 남은 소량 조합을 딱 맞게
//    채워줄 대안이 없을 수 있어서다.
// 4) (자투리 배치) 300mm 미만인 소형 품목은 남겨도 재사용하지 않으므로,
//    코어(300mm 이상) 품목으로 이미 정해진 배치들의 남는 여백 중 가장 넓은
//    곳부터 채워 넣는다 — 어차피 버려질 자투리라 자재비 부담이 없고, 좁은
//    구석보다 넓은 여백에서 자르는 게 작업자에게 더 편하기 때문이다.
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
  // 다 자르고 남는 빈 공간(자투리) — 큰 것부터 최대 2개까지.
  leftover: { x: number; y: number; width: number; height: number }[];
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

    // 300mm 미만(가로·세로 둘 다)인 소형 품목은 "자투리"로 취급해 별도 연을
    // 새로 만들지 않고, 아래에서 코어 품목 배치가 정해진 뒤 그 남는 여백에
    // 얹는다. 코어 품목이 하나도 없으면(전부 소형) 기존 방식 그대로 전체
    // 품목을 대상으로 계산한다.
    const coreItems = items.filter((it) => !this.isFiller(it));
    const fillerItems = items.filter((it) => this.isFiller(it));
    const primaryItems = coreItems.length > 0 ? coreItems : items;

    const remaining: Record<string, number> = {};
    for (const item of primaryItems) remaining[item.name] = item.orderQty;

    const combinations = this.generateCombinations(primaryItems);
    const patterns = this.buildPatterns(combinations);

    if (patterns.length === 0) {
      // 어떤 품목도 원지 안에 들어가지 않는 경우 (치수 오류 등)
      const remainingAll: Record<string, number> = {};
      for (const item of items) remainingAll[item.name] = item.orderQty;
      return this.emptyReport(remainingAll);
    }

    // Cutting Stock 그리디 탐색: 원지를 한 장씩 쌓지 않고 "이 패턴을 몇 장
    // 썼는지"만 누적한다. 같은 패턴이 수천 번 반복돼도 결과에는 "패턴 1개 +
    // 사용 장수"로만 남는다.
    const patternUsage = new Map<Pattern, number>();
    let overProduction = 0;
    let totalSheetsUsed = 0;
    const safetyLimit = this.safetySheetLimit(primaryItems);

    // 마무리 패스: 발주 전체 품목 조합 기준으로 미리 만들어둔 patterns는
    // "이 시점에 정확히 뭐가 얼마나 남았는지"를 모른 채로 만들어졌다. 품목이
    // 하나씩 다 채워져서 남은 품목 구성이 바뀔 때마다, 그 순간 남아있는
    // 품목들만 가지고 배치를 새로 탐색해서 후보에 더해준다 — 사람이 "이제
    // 뭐 남았지, 이걸로 마지막 판 짜자" 하는 것과 같은 방식이다. 품목이
    // 1개만 남으면 이미 기본 patterns에 있는 단일 품목 배치와 같아서 다시
    // 찾을 필요가 없고, 4개 이상이면 비용이 커서 2~3개일 때만 돌린다.
    let tailPatterns: Pattern[] = [];
    let tailActiveKey = "";

    while (Object.values(remaining).some((qty) => qty > 0)) {
      if (totalSheetsUsed >= safetyLimit) {
        // 이론상 도달하면 안 되는 상황(무한루프 방지용 안전장치)
        break;
      }

      const activeItems = primaryItems.filter((it) => (remaining[it.name] ?? 0) > 0);
      const activeKey = activeItems
        .map((it) => it.name)
        .sort()
        .join(",");
      if (activeKey !== tailActiveKey && activeItems.length >= 2 && activeItems.length <= 3) {
        tailActiveKey = activeKey;
        const tailCombinations = this.generateCombinations(activeItems);
        tailPatterns = this.buildPatterns(tailCombinations, { perComboMs: 300, globalMs: 1500 });
      }

      const candidatePatterns = tailPatterns.length ? [...patterns, ...tailPatterns] : patterns;
      const pattern = this.selectBestPattern(candidatePatterns, remaining);
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

    const batches: [Pattern, number][] = Array.from(patternUsage.entries()).filter(
      ([, count]) => count > 0
    );

    // 자투리 품목(300mm 미만)을 이미 확정된 배치들의 남는 여백에 채워
    // 넣는다. 코어 품목으로 이미 정해진 연 수에는 영향을 주지 않는다.
    let allRemaining: Record<string, number> = { ...remaining };
    let allOverProduction = overProduction;
    if (fillerItems.length > 0) {
      const { fillerRemaining, fillerOverProduction, extraSheets } = this.attachFillersToBatches(
        batches,
        fillerItems
      );
      allRemaining = { ...allRemaining, ...fillerRemaining };
      allOverProduction += fillerOverProduction;
      totalSheetsUsed += extraSheets;
    }

    const fulfilled = Object.values(allRemaining).every((qty) => qty <= 0);

    return this.buildReport(batches, totalSheetsUsed, allOverProduction, fulfilled, allRemaining);
  }

  // 가로·세로 둘 다 300mm 미만이면 "자투리"로 취급한다 — 재사용하지 않는
  // 소형 품목이라 자재비 부담 없이 남는 배치의 여백에 끼워 넣을 수 있다.
  private isFiller(item: Item): boolean {
    const fillerMaxMm = 300;
    return item.width < fillerMaxMm && item.height < fillerMaxMm;
  }

  // 어떤 placements 집합이 시트 위에서 실제로 차지하고 남은 빈 사각형들을
  // 계산한다. buildPatterns에서 쓰는 것과 같은 FreeRect 분할 로직을 그대로
  // 재사용해서, 패턴이 원래 어떻게 만들어졌든(격자든 DFS든) 상관없이 최종
  // placements만으로 여백을 다시 구할 수 있게 한다.
  private computeFreeRects(placements: Placement[]): FreeRect[] {
    const m = this.marginMm;
    let freeRects: FreeRect[] = [
      { x: m, y: m, width: this.sheetWidth - m * 2, height: this.sheetHeight - m * 2 },
    ];

    for (const placement of placements) {
      const target = freeRects.find(
        (r) =>
          placement.x >= r.x &&
          placement.y >= r.y &&
          placement.x + placement.width <= r.x + r.width &&
          placement.y + placement.height <= r.y + r.height
      );
      if (!target) continue;
      freeRects = this.placeRect(freeRects, target, placement);
    }

    return freeRects.filter((r) => r.width > 1 && r.height > 1);
  }

  // 자유 사각형들 중 이 품목을 가장 많이 채울 수 있는 자리를 찾는다
  // (buildSingleItemPattern과 같은 격자 계산이지만, 시트 전체가 아니라
  // 주어진 자유 사각형 하나에 대해서만 계산한다).
  private bestFitInRects(
    rects: FreeRect[],
    item: Item
  ): { rect: FreeRect; w: number; h: number; cols: number; rows: number; count: number } | null {
    let best: { rect: FreeRect; w: number; h: number; cols: number; rows: number; count: number } | null = null;

    for (const rect of rects) {
      for (const rotated of [false, true]) {
        const w = rotated ? item.height : item.width;
        const h = rotated ? item.width : item.height;
        if (w <= 0 || h <= 0 || w > rect.width || h > rect.height) continue;
        const cols = Math.floor(rect.width / w);
        const rows = Math.floor(rect.height / h);
        const count = cols * rows;
        if (count > 0 && (!best || count > best.count)) {
          best = { rect, w, h, cols, rows, count };
        }
      }
    }

    return best;
  }

  // 확정된 코어 배치들의 남는 여백에 자투리 품목을 끼워 넣는다. 여백이 가장
  // 넓은 배치부터 채우고(작업자 편의 우선), 그래도 다 못 채우면 그 품목만을
  // 위한 별도 연을 추가해서 발주량을 반드시 충족시킨다.
  private attachFillersToBatches(
    batches: [Pattern, number][],
    fillerItems: Item[]
  ): { fillerRemaining: Record<string, number>; fillerOverProduction: number; extraSheets: number } {
    const fillerRemaining: Record<string, number> = {};
    let fillerOverProduction = 0;
    let extraSheets = 0;

    type BatchSpace = { pattern: Pattern; reps: number; freeRects: FreeRect[] };
    const spaces: BatchSpace[] = batches.map(([pattern, reps]) => ({
      pattern,
      reps,
      freeRects: this.computeFreeRects(pattern.placements),
    }));

    const largestArea = (s: BatchSpace) =>
      s.freeRects.reduce((max, r) => Math.max(max, r.width * r.height), 0);

    for (const item of fillerItems) {
      let need = item.orderQty;

      let guard = 0;
      while (need > 0 && guard < 1000) {
        guard += 1;

        const ordered = [...spaces].sort((a, b) => largestArea(b) - largestArea(a));
        const space = ordered[0];
        if (!space || largestArea(space) <= 0) break;

        const fit = this.bestFitInRects(space.freeRects, item);
        if (!fit) {
          space.freeRects = [];
          continue;
        }

        const produced = fit.count * space.reps;
        const used = Math.min(produced, need);
        need -= used;
        if (produced > used) fillerOverProduction += produced - used;

        for (let r = 0; r < fit.rows; r++) {
          for (let c = 0; c < fit.cols; c++) {
            space.pattern.placements.push({
              name: item.name,
              x: fit.rect.x + c * fit.w,
              y: fit.rect.y + r * fit.h,
              width: fit.w,
              height: fit.h,
              rotated: fit.w !== item.width,
            });
          }
        }
        space.pattern.counts[item.name] = (space.pattern.counts[item.name] ?? 0) + fit.count;
        space.pattern.coveredArea += fit.count * item.width * item.height;

        const usedBlock: Placement = {
          name: item.name,
          x: fit.rect.x,
          y: fit.rect.y,
          width: fit.cols * fit.w,
          height: fit.rows * fit.h,
          rotated: false,
        };
        space.freeRects = this.placeRect(space.freeRects, fit.rect, usedBlock);
      }

      if (need > 0) {
        // 어떤 배치의 여백에도 못 들어가면(극단적으로 여백이 좁은 경우)
        // 이 품목만을 위한 별도 연을 추가해서 발주량을 반드시 채운다.
        const pattern = this.buildSingleItemPattern(item);
        const perSheet = pattern?.counts[item.name] ?? 0;
        if (pattern && perSheet > 0) {
          const reps = this.sheetPerReam;
          const repsNeeded = Math.ceil(need / (perSheet * reps)) * reps;
          batches.push([pattern, repsNeeded]);
          extraSheets += repsNeeded;
          const produced = perSheet * repsNeeded;
          fillerOverProduction += produced - need;
          need = 0;
        }
      }

      fillerRemaining[item.name] = need;
    }

    return { fillerRemaining, fillerOverProduction, extraSheets };
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

  private buildPatterns(combinations: Item[][], budget?: { perComboMs: number; globalMs: number }): Pattern[] {
    const patterns: Pattern[] = [];
    const perComboMs = budget?.perComboMs ?? 800;
    const globalMs = budget?.globalMs ?? 5000;

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
    const globalDeadline = Date.now() + globalMs;

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
        Date.now() + perComboMs
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
  //
  // 패턴 하나를 고르면 무조건 한 연(sheetPerReam장)만큼 찍어낸다. 그래서
  // "장당 개수"가 아니라 "그 연 전체를 찍었을 때 실제로 쓰이는 개수"를
  // 기준으로 점수를 매겨야 한다 — 예를 들어 장당 2개 나오는 품목이 딱
  // 500개만 남았는데 그대로 1연(500장)을 다 찍으면 1,000개가 나와 절반이
  // 그냥 초과생산으로 버려진다. 장당 개수만 보고 점수를 매기면 이 낭비가
  // 전혀 페널티로 반영되지 않아, 마지막에 남은 소량을 다른 품목과 같이
  // 배치하는 혼합 패턴보다도 이 낭비 패턴이 더 높은 점수를 받는 문제가 있었다.
  private selectBestPattern(patterns: Pattern[], remaining: Record<string, number>): Pattern | null {
    const nameToItem = new Map(this.items.map((item) => [item.name, item]));
    const sheetArea = this.sheetWidth * this.sheetHeight;
    const reps = this.sheetPerReam;

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
        // 이 연(reps장) 전체를 찍었을 때 실제로 필요한 만큼만(초과분 제외)
        // 장당 개수로 환산해서 인정한다.
        const usefulCountPerSheet = reps ? Math.min(count * reps, rem) / reps : Math.min(count, rem);
        usefulArea += usefulCountPerSheet * item.width * item.height;
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

      // 실제로 다 자르고 남는 빈 사각형(자투리)을 큰 것부터 최대 2개까지
      // 도면에 표기할 수 있도록 넘긴다.
      const leftover = this.computeFreeRects(placements)
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 2)
        .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));

      layouts.push({
        paperW: this.sheetWidth,
        paperH: this.sheetHeight,
        items: itemsOut,
        margin: { usage, right: rightMargin, bottom: bottomMargin, area: wasteArea },
        sheetCount,
        batchReams: Math.round(batchReamsExact * 100) / 100,
        leftover,
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

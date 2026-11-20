// 표 줄 상태의 "되돌리기/다시 실행(Ctrl+Z / Ctrl+Y)" 기록 — 화면·React와 무관한 순수 로직이라 따로 테스트한다.
// 쓰는 곳: use-keyed-rows.ts(매출/매입 등 줄 입력 표).
//
// 기록 방식: 값이 바뀔 때마다 "바뀌기 전 값"을 쌓는다.
//  · 줄 추가·삭제·순서 변경(structural)은 항상 한 단계로 남긴다 — 줄 하나 지운 것을 한 번에 되돌릴 수 있게.
//  · 같은 칸에 글자를 계속 치는 것 같은 연속 수정은 coalesceMs(기본 0.7초) 안이면 한 단계로 합친다 — 한 글자씩 되돌리지 않게.
//  · 되돌린 뒤 새로 고치면 "다시 실행" 기록은 지워진다(일반 편집기와 같다).
export function createRowsHistory<T>(opts: { max?: number; coalesceMs?: number; now?: () => number } = {}) {
  const max = opts.max ?? 100;
  const coalesceMs = opts.coalesceMs ?? 700;
  const now = opts.now ?? Date.now;
  let past: T[] = [];
  let future: T[] = [];
  let lastAt = 0;

  return {
    /** prev → 새 값으로 바뀌었음을 알린다(prev는 바뀌기 전 값). */
    record(prev: T, structural: boolean) {
      const t = now();
      if (structural || t - lastAt > coalesceMs) {
        past.push(prev);
        if (past.length > max) past.shift();
      }
      // 줄 추가·삭제 직후의 첫 수정은 그 변경과 합치지 않고 새 단계로 둔다(줄을 추가하자마자 값을 쳐도 따로 되돌릴 수 있게).
      lastAt = structural ? 0 : t;
      future = [];
    },
    /** 한 단계 되돌린 값을 돌려준다(없으면 undefined). current는 지금 값 — "다시 실행"용으로 보관한다. */
    undo(current: T): T | undefined {
      const prev = past.pop();
      if (prev === undefined) return undefined;
      future.push(current);
      lastAt = 0; // 되돌린 직후의 첫 수정은 새 단계로
      return prev;
    },
    redo(current: T): T | undefined {
      const next = future.pop();
      if (next === undefined) return undefined;
      past.push(current);
      lastAt = 0;
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past = [];
      future = [];
      lastAt = 0;
    },
  };
}

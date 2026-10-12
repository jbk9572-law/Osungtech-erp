type AssigneeStep = { sort_order: number; assignee_kind: string };

// 1차 공정(가장 작은 sort_order)이 외주 배정인지 — 생산지시 목록/상세
// 양쪽에서 "자재투입" vs "외주 자재출고" 분기에 쓰인다. 호출부가 매번
// steps를 sort_order로 정렬했다고 가정하고 steps[0]만 보면, 쿼리의
// order()를 빠뜨렸을 때 조용히 틀린 값을 내는 버그가 생기기 쉬워
// (실제로 생산관리 목록에서 한 번 발생했다) 여기서 직접 정렬한다.
export function isFirstStepSubcontractor<T extends AssigneeStep>(steps: T[] | null | undefined): boolean {
  if (!steps || steps.length === 0) return false;
  const first = steps.reduce((min, s) => (s.sort_order < min.sort_order ? s : min));
  return first.assignee_kind === "subcontractor";
}

// 생산지시 목록처럼 여러 work_order의 공정을 한 번에 조회했을 때, work_order_id별
// "1차 공정이 외주인가" 맵을 만든다.
export function buildFirstStepIsSubcontractorMap<T extends AssigneeStep & { work_order_id: string }>(
  steps: T[] | null | undefined,
): Map<string, boolean> {
  const byOrder = new Map<string, T[]>();
  for (const s of steps ?? []) {
    const list = byOrder.get(s.work_order_id);
    if (list) list.push(s);
    else byOrder.set(s.work_order_id, [s]);
  }
  const result = new Map<string, boolean>();
  for (const [workOrderId, orderSteps] of byOrder) {
    result.set(workOrderId, isFirstStepSubcontractor(orderSteps));
  }
  return result;
}

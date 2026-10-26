import type { BadgeTone } from "@/components/grid/badge";

export type StatusLabelMap = Record<string, { label: string; tone: BadgeTone }>;

// 상태값 → {label, tone} 조회 + "맵에 없는 상태면 원래 문자열을 그대로
// 보여주고 톤은 muted로" 떨어지는 폴백을, 결재/기안/지급결의서/구매요청/
// 작업지시/견적/공문/근태 등 16개 화면이 각자
// `STATUS_LABEL[x] ?? { label: x, tone: "muted" as const }` 형태로 복붙해
// 쓰고 있었다(헌법검사 발견) — 상태 값·라벨 자체는 화면마다 의미가 전혀
// 달라 하나의 사전으로 합칠 수 없지만, "없으면 muted로 떨어지는 조회"
// 동작 자체는 공용화한다. 각 화면은 자기 STATUS_LABEL 사전은 그대로 두고
// 조회만 이 함수로 바꾼다.
export function resolveStatusLabel(map: StatusLabelMap, status: string): { label: string; tone: BadgeTone } {
  return map[status] ?? { label: status, tone: "muted" };
}

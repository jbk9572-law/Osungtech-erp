// ERP 응답속도 기준 — 반복 입력하는 사무 업무에서 "기다린다"고 느끼기 시작하는 선. 이 기준을 넘는 순간만 기록한다
// (느린 화면 기록: 서버 page-timing.ts, 사용자가 실제로 체감한 이동 시간: nav-timing-reporter.tsx).
// 기준을 바꿀 때는 여기 한 곳만 고친다.
export const PERF_BUDGET = {
  // 클릭 후 화면(내용까지)이 보이기까지 — 이보다 오래 걸린 이동을 느림으로 기록한다.
  navigationMs: 2000,
  // 화면 하나가 서버에서 만들어지는 시간.
  serverPageMs: 800,
  // 한 화면이 Supabase를 부른 횟수 — 넘으면 시간이 짧아도 "조회가 과하다"고 기록한다.
  dbCallsPerPage: 30,
} as const;

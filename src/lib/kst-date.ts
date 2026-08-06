// 서버(Node.js) 프로세스는 보통 UTC로 실행되는데, "오늘"을 new Date()의
// getFullYear/getMonth/getDate로 그대로 구하면 한국 자정~오전 9시 사이엔
// 서버가 아직 어제라고 착각한다(UTC가 KST보다 9시간 느리므로). 이 시스템은
// 한국에서만 쓰이므로 타임존을 Asia/Seoul(UTC+9, DST 없음)로 고정해서 "지금"
// 시각의 한국 기준 연/월/일을 구한다.
//
// 클라이언트 컴포넌트("use client")는 브라우저의 로컬 시계를 그대로 쓰므로
// 이 헬퍼가 필요 없다 — 서버 컴포넌트/서버 액션/API 라우트에서 "오늘"을
// 구할 때만 쓴다.
//
// nowInKst()가 돌려주는 Date는 실제 시각(getTime())이 아니라 "UTC getter로
// 읽으면 한국 벽시계 값이 나오도록 9시간 밀어둔 값"이다. 그 필드를
// getUTCFullYear()/getUTCMonth()/getUTCDate() 등으로 뽑아서
// new Date(y, m, d) 같은 로컬 산술의 시작값으로만 쓴다 — 그 이후의 산술은
// 같은 프로세스 안에서 구성·해석이 다 로컬 타임존으로 일관되게 이뤄지므로
// 서버가 어느 타임존이든 결과가 달라지지 않는다.
export function nowInKst(now: Date = new Date()): Date {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayKstStr(now: Date = new Date()): string {
  const kst = nowInKst(now);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

// 임의의 Date(주로 now에서 며칠 더한 값)를 한국 기준 YYYY-MM-DD 문자열로
// 바꾼다. 예: 마감 3일 이내 할일을 구할 때 "3일 뒤"를 한국 기준으로 정확히
// 표기해야 한다.
export function toKstDateStr(date: Date): string {
  return todayKstStr(date);
}

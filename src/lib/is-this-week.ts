// "이번주 등록" 요약카드 계산에 쓰는 순수 함수. 원래
// announcement-list-body.tsx("use client")에 있었는데, 서버 컴포넌트인
// announcements/page.tsx가 그 함수를 직접 호출하고 있었다 — "use client"
// 파일에서 가져온 export는(컴포넌트가 아니어도) 서버 번들에서는 실제
// 함수가 아니라 클라이언트 레퍼런스로 치환되므로, 직접 호출하면 실제
// 배포(RSC 번들링)에서만 "Minified React error #441"로 깨진다(로컬
// tsc/vitest는 변환 없이 그냥 실행해버려서 못 잡는다). 서버 컴포넌트가
// 호출해야 하는 순수 함수는 "use client" 파일 밖, 이런 평범한 lib
// 파일에 둬야 한다.
export function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < 7;
}

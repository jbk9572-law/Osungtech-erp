import { timingSafeEqual } from "node:crypto";

// 크론 엔드포인트의 "Authorization: Bearer <secret>" 검사를 한 곳에서 한다.
// 예전엔 세 라우트가 각자 `authHeader !== \`Bearer ${secret}\``로 비교했는데,
// 문자열 비교는 일치하는 앞부분이 길수록 오래 걸려서(타이밍 차이) 비밀값을
// 한 글자씩 추측하는 공격에 이론상 취약하다 — 길이가 달라도 같은 시간에
// 끝나는 상수시간 비교로 통일한다.
export function isValidBearer(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  if (actual.length !== expected.length) {
    // 길이가 달라도 같은 양의 비교 작업을 해서 길이 정보가 시간으로 새지 않게 한다.
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(actual, expected);
}

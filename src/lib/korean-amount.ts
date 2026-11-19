// 금액을 한글로 — 명세표 합계의 "일금 사백일만오천원정" 같은 표기. 정수(원 단위)만 다루고 소수는 반올림한다.
// 자릿수마다 "일"을 빼지 않는다(서류 관례: 일만 · 일백만) — 10,000 → "일만", 1,000,000 → "일백만".
const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];
const BIG_UNITS = ["", "만", "억", "조", "경"];

export function koreanAmount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  if (rounded === 0) return "영";
  const sign = rounded < 0 ? "마이너스 " : "";
  let rest = Math.abs(rounded);
  const groups: string[] = [];
  let bigIndex = 0;
  while (rest > 0 && bigIndex < BIG_UNITS.length) {
    const group = rest % 10000;
    rest = Math.floor(rest / 10000);
    if (group > 0) {
      let text = "";
      for (let pos = 3; pos >= 0; pos--) {
        const digit = Math.floor(group / 10 ** pos) % 10;
        if (digit > 0) text += DIGITS[digit] + SMALL_UNITS[pos];
      }
      groups.unshift(text + BIG_UNITS[bigIndex]);
    }
    bigIndex++;
  }
  return sign + groups.join("");
}

/** 명세표 합계 문구: "일금 사백일만오천원정" */
export function koreanAmountLine(value: number): string {
  return `일금 ${koreanAmount(value)}원정`;
}

// 홈택스 일괄발급(100건 이하) 엑셀 양식의 "항목설명"/"잘못된 예시" 시트에
// 적힌 규칙을 코드로 옮긴 것 — 실제로 홈택스에 업로드해보는 테스트는 이
// 세션에서 할 수 없다(hometax.go.kr은 이 환경 네트워크 정책상 접근 불가,
// 인증서도 없고, 설령 접근 가능해도 "테스트 모드"가 없어 실제 업로드가
// 바로 진짜 세금계산서 신고가 된다). 대신 양식 자체에 적힌 형식 규칙을
// 어기지 않는지는 미리 걸러낼 수 있다 — 흔한 실패 패턴(등록번호에 하이픈,
// 날짜 형식 오류, 글자수 초과, 품목 누락 등)은 여기서 잡힌다. 다만 이걸
// 통과해도 국세청 서버가 또 다른 이유로 거부할 가능성까지 없애주진 못한다.

// "영문자, 숫자는 1byte, 한글은 2byte" — 양식의 "항목설명" 시트 안내
// 그대로. 실제 UTF-8 바이트 수(한글 3바이트)가 아니라 이 2바이트 규칙으로
// 셈한다.
export function hometaxByteLength(value: string): number {
  let len = 0;
  for (const ch of value) {
    len += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return len;
}

type FieldRule =
  | { kind: "enum"; values: string[] }
  | { kind: "digits"; exactLengths?: number[]; maxBytes?: number; optional?: boolean }
  | { kind: "text"; maxBytes: number; optional?: boolean }
  | { kind: "day" }
  | { kind: "amount"; maxIntDigits: number; maxDecimalDigits?: number; optional?: boolean };

const ITEM_FIELD_RULES: [string, FieldRule][] = [
  ["일자", { kind: "day" }],
  ["품목", { kind: "text", maxBytes: 100, optional: true }],
  ["규격", { kind: "text", maxBytes: 60, optional: true }],
  ["수량", { kind: "amount", maxIntDigits: 10, maxDecimalDigits: 2, optional: true }],
  ["단가", { kind: "amount", maxIntDigits: 13, maxDecimalDigits: 2, optional: true }],
  ["공급가액", { kind: "amount", maxIntDigits: 15, optional: true }],
  ["세액", { kind: "amount", maxIntDigits: 15, optional: true }],
  ["품목비고", { kind: "text", maxBytes: 100, optional: true }],
];

// 열 이름 -> 규칙. HOMETAX_BULK_EXCEL_HEADERS와 같은 순서/구성이어야
// 하므로, 테스트에서 두 목록의 길이가 일치하는지도 확인한다.
export const HOMETAX_FIELD_RULES: FieldRule[] = [
  { kind: "enum", values: ["01", "02"] }, // 종류
  { kind: "digits", exactLengths: [8] }, // 작성일자 YYYYMMDD
  { kind: "digits", exactLengths: [10] }, // 공급자 등록번호
  { kind: "digits", maxBytes: 4, optional: true }, // 공급자 종사업장번호
  { kind: "text", maxBytes: 70 }, // 공급자 상호
  { kind: "text", maxBytes: 30 }, // 공급자 성명
  { kind: "text", maxBytes: 150, optional: true }, // 공급자 사업장주소
  { kind: "text", maxBytes: 40, optional: true }, // 공급자 업태
  { kind: "text", maxBytes: 60, optional: true }, // 공급자 종목
  { kind: "text", maxBytes: 40, optional: true }, // 공급자 이메일
  { kind: "digits", exactLengths: [10, 13] }, // 공급받는자 등록번호
  { kind: "digits", maxBytes: 4, optional: true }, // 공급받는자 종사업장번호
  { kind: "text", maxBytes: 70 }, // 공급받는자 상호
  { kind: "text", maxBytes: 30, optional: true }, // 공급받는자 성명
  { kind: "text", maxBytes: 150, optional: true }, // 공급받는자 사업장주소
  { kind: "text", maxBytes: 40, optional: true }, // 공급받는자 업태
  { kind: "text", maxBytes: 60, optional: true }, // 공급받는자 종목
  { kind: "text", maxBytes: 40, optional: true }, // 공급받는자 이메일1
  { kind: "text", maxBytes: 40, optional: true }, // 공급받는자 이메일2
  { kind: "amount", maxIntDigits: 15 }, // 공급가액 합계
  { kind: "amount", maxIntDigits: 15 }, // 세액 합계
  { kind: "text", maxBytes: 150, optional: true }, // 비고
  ...([1, 2, 3, 4].flatMap(() => ITEM_FIELD_RULES.map(([, rule]) => rule)) as FieldRule[]),
  { kind: "amount", maxIntDigits: 15, optional: true }, // 현금
  { kind: "amount", maxIntDigits: 15, optional: true }, // 수표
  { kind: "amount", maxIntDigits: 15, optional: true }, // 어음
  { kind: "amount", maxIntDigits: 15, optional: true }, // 외상미수금
  { kind: "enum", values: ["01", "02"] }, // 영수/청구
];

function checkField(label: string, value: unknown, rule: FieldRule): string[] {
  const errors: string[] = [];
  const str = value == null ? "" : String(value);

  if (rule.kind === "enum") {
    if (!rule.values.includes(str)) errors.push(`${label}: "${str}" — ${rule.values.join("/")} 중 하나여야 합니다.`);
    return errors;
  }

  if (str === "") {
    if (rule.kind === "text" && !rule.optional) errors.push(`${label}: 비어있습니다(필수 항목).`);
    if (rule.kind === "digits" && !rule.optional) errors.push(`${label}: 비어있습니다(필수 항목).`);
    return errors;
  }

  if (rule.kind === "digits") {
    if (!/^[0-9]+$/.test(str)) errors.push(`${label}: "${str}" — 숫자만 입력해야 합니다("-" 등 기호 불가).`);
    if (rule.exactLengths && !rule.exactLengths.includes(str.length)) {
      errors.push(`${label}: 자릿수 ${str.length} — ${rule.exactLengths.join("/")}자리여야 합니다.`);
    }
    if (rule.maxBytes && hometaxByteLength(str) > rule.maxBytes) {
      errors.push(`${label}: 길이 초과(최대 ${rule.maxBytes}바이트).`);
    }
    return errors;
  }

  if (rule.kind === "text") {
    if (hometaxByteLength(str) > rule.maxBytes) errors.push(`${label}: 길이 초과(최대 ${rule.maxBytes}바이트).`);
    return errors;
  }

  if (rule.kind === "day") {
    if (!/^[0-9]{2}$/.test(str)) errors.push(`${label}: "${str}" — 2자리 숫자(일)여야 합니다.`);
    return errors;
  }

  if (rule.kind === "amount") {
    const n = Number(str);
    if (!Number.isFinite(n)) {
      errors.push(`${label}: "${str}" — 숫자가 아닙니다.`);
      return errors;
    }
    const [intPart, decPart] = Math.abs(n).toString().split(".");
    if (intPart.length > rule.maxIntDigits) errors.push(`${label}: 정수부 자릿수 초과(최대 ${rule.maxIntDigits}자리).`);
    if (rule.maxDecimalDigits !== undefined && decPart && decPart.length > rule.maxDecimalDigits) {
      errors.push(`${label}: 소수점 자릿수 초과(최대 ${rule.maxDecimalDigits}자리).`);
    }
    return errors;
  }

  return errors;
}

// 품목1~4: 일자/품목명이 서로 짝이 안 맞으면(한쪽만 채움) "잘못된 예시"
// 시트에 실제로 나온 실패 패턴이라 별도로 잡는다.
function checkItemConsistency(headers: readonly string[], row: Record<string, unknown>): string[] {
  const errors: string[] = [];
  let anyItemFilled = false;
  for (let n = 1; n <= 4; n++) {
    const day = String(row[`일자${n}\n(2자리, 작성년월 제외)`] ?? "");
    const name = String(row[`품목${n}`] ?? "");
    if (name.trim()) anyItemFilled = true;
    if ((day && !name.trim()) || (!day && name.trim())) {
      errors.push(`품목${n}: 일자와 품목명 중 한쪽만 채워져 있습니다 — 둘 다 채우거나 둘 다 비워야 합니다.`);
    }
  }
  if (!anyItemFilled) errors.push("품목: 1건 이상 입력해야 합니다(전부 비어있음).");

  const headerSupply = Number(row[headers[19]] ?? 0);
  const headerTax = Number(row[headers[20]] ?? 0);
  let itemSupplySum = 0;
  let itemTaxSum = 0;
  for (let n = 1; n <= 4; n++) {
    itemSupplySum += Number(row[`공급가액${n}`] ?? 0) || 0;
    itemTaxSum += Number(row[`세액${n}`] ?? 0) || 0;
  }
  if (headerSupply !== itemSupplySum) {
    errors.push(`공급가액 합계(${headerSupply})가 품목별 공급가액 합(${itemSupplySum})과 다릅니다.`);
  }
  if (headerTax !== itemTaxSum) {
    errors.push(`세액 합계(${headerTax})가 품목별 세액 합(${itemTaxSum})과 다릅니다.`);
  }
  return errors;
}

// 생성한 엑셀 한 행(row)이 홈택스 양식 규칙을 지키는지 검사한다.
// headers는 HOMETAX_BULK_EXCEL_HEADERS와 같은 순서여야 한다.
export function validateHometaxRow(headers: readonly string[], row: Record<string, unknown>): string[] {
  const errors: string[] = [];
  headers.forEach((label, i) => {
    const rule = HOMETAX_FIELD_RULES[i];
    if (!rule) return;
    errors.push(...checkField(label.replace(/\n/g, " ").trim(), row[label], rule));
  });
  errors.push(...checkItemConsistency(headers, row));
  return errors;
}

// IMAP 폴더 이름은 RFC 3501의 "modified UTF-7"로 인코딩된다 — 다음
// 스마트워크의 "받은편지함/보낸편지함/스팸편지함" 같은 한글 폴더명을
// 화면에 정상 표시하고, 그 폴더를 SELECT할 때도 다시 같은 인코딩으로
// 보내야 한다. 일반 UTF-7과 다르게 '+' 대신 '&'를 시프트 문자로 쓰고,
// base64의 '/'를 ','로 바꿔 쓴다.

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+,";

export function decodeImapUtf7(input: string): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch !== "&") {
      result += ch;
      i++;
      continue;
    }
    // "&-"는 리터럴 '&' 한 글자.
    if (input[i + 1] === "-") {
      result += "&";
      i += 2;
      continue;
    }
    let j = i + 1;
    while (j < input.length && input[j] !== "-") j++;
    const shifted = input.slice(i + 1, j);
    let bitBuffer = 0;
    let bitCount = 0;
    const units: number[] = [];
    for (const c of shifted) {
      const val = B64_CHARS.indexOf(c);
      if (val === -1) continue;
      bitBuffer = (bitBuffer << 6) | val;
      bitCount += 6;
      if (bitCount >= 16) {
        bitCount -= 16;
        units.push((bitBuffer >> bitCount) & 0xffff);
      }
    }
    result += String.fromCharCode(...units);
    // 종료 '-'가 있으면 구분자로 소비하고, 없으면(문자열 끝) 그대로 종료.
    i = j < input.length ? j + 1 : j;
  }
  return result;
}

export function encodeImapUtf7(input: string): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const code = input.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      result += ch === "&" ? "&-" : ch;
      i++;
      continue;
    }
    // 연속된 non-ASCII 구간을 한 번에 묶어서 인코딩한다.
    let j = i;
    const units: number[] = [];
    while (j < input.length) {
      const c = input.charCodeAt(j);
      if (c >= 0x20 && c <= 0x7e) break;
      units.push(c);
      j++;
    }
    let bitBuffer = 0;
    let bitCount = 0;
    let b64 = "";
    for (const unit of units) {
      bitBuffer = (bitBuffer << 16) | unit;
      bitCount += 16;
      while (bitCount >= 6) {
        bitCount -= 6;
        b64 += B64_CHARS[(bitBuffer >> bitCount) & 0x3f];
      }
    }
    if (bitCount > 0) {
      b64 += B64_CHARS[(bitBuffer << (6 - bitCount)) & 0x3f];
    }
    result += "&" + b64 + "-";
    i = j;
  }
  return result;
}

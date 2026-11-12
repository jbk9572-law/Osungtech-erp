// 사용자가 입력한 메일 서버 주소로 우리 서버가 직접 접속하므로(연결 테스트·동기화·발송), 내부망/로컬
// 주소나 메타데이터 주소를 넣어 서버가 내부 시스템에 접속하게 만드는 것(SSRF)을 막는다.
// 일반 메일 서비스(imap.daum.net, smtp.gmail.com 등)는 공개 도메인 이름이므로 영향이 없다.
const ALLOWED_PORTS = new Set([25, 143, 465, 587, 993, 995, 2525]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export function isSafeMailHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase();
  if (!host || host.length > 253) return false;
  // 도메인 이름 형식만 허용(IPv6 리터럴/포트 포함/경로 포함 거부).
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return false;
  if (isPrivateIPv4(host)) return false;
  if (/^\d+(\.\d+)*$/.test(host)) return false; // 숫자만 있는 변형 표기(예: 2130706433)
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
    return false;
  }
  return true;
}

export function isSafeMailPort(port: number): boolean {
  return Number.isInteger(port) && ALLOWED_PORTS.has(port);
}

export const UNSAFE_MAIL_SERVER_MESSAGE =
  "메일 서버 주소 또는 포트가 올바르지 않습니다. 메일 서비스의 공개 서버 주소와 표준 포트(993, 465 등)를 입력해주세요.";

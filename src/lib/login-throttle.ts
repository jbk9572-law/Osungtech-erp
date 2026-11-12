// 로그인 비밀번호 대입(브루트포스) 공격을 막는 시도 횟수 제한.
//
// 이 앱은 단일 상시 가동 Node 서버(docker-compose 한 대)라서 프로세스 메모리에
// 실패 횟수를 세도 충분하다 — 서버를 재시작하면 카운터가 초기화되는 한계가
// 있지만 공격 속도를 늦추는 데는 문제없다. 서버를 여러 대로 늘리면 이 저장소를
// DB/Redis로 바꿔야 한다.
//
// 세는 단위: (접속지 IP + 아이디) 와 (접속지 IP 전체). 아이디만으로 세면
// 공격자가 남의 아이디로 일부러 실패를 쌓아 그 사람을 잠가버릴 수 있어서
// (서비스 거부), 항상 접속지와 묶어서 센다. 성공하면 그 아이디의 카운터를 비운다.
// 같은 사무실(같은 공인 IP)의 여러 직원이 쓰는 점을 고려해 IP 전체 한도는
// 아이디별 한도보다 넉넉하게 둔다.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS_PER_ID = 5;
const MAX_FAILS_PER_IP = 30;

type Bucket = { fails: number; windowStart: number };
const buckets = new Map<string, Bucket>();

function current(key: string, now: number): Bucket {
  const b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    const fresh = { fails: 0, windowStart: now };
    buckets.set(key, fresh);
    return fresh;
  }
  return b;
}

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (now - b.windowStart > WINDOW_MS) buckets.delete(k);
}

export function loginKeys(ip: string, loginId: string) {
  return { idKey: `id:${ip}:${loginId.toLowerCase()}`, ipKey: `ip:${ip}` };
}

/** 남은 대기 시간(초). 0이면 시도 가능. */
export function throttleRemainingSeconds(ip: string, loginId: string, now = Date.now()): number {
  const { idKey, ipKey } = loginKeys(ip, loginId);
  const idB = current(idKey, now);
  const ipB = current(ipKey, now);
  // 접속지를 알 수 없으면(unknown) 모든 사용자가 한 통을 쓰게 되어 서로 잠그므로
  // IP 전체 한도는 적용하지 않고 아이디 단위 한도만 쓴다.
  const ipLimited = ip !== "unknown" && ipB.fails >= MAX_FAILS_PER_IP;
  const blocked = idB.fails >= MAX_FAILS_PER_ID || ipLimited;
  if (!blocked) return 0;
  const start = idB.fails >= MAX_FAILS_PER_ID ? idB.windowStart : ipB.windowStart;
  return Math.max(1, Math.ceil((start + WINDOW_MS - now) / 1000));
}

export function recordLoginFailure(ip: string, loginId: string, now = Date.now()) {
  sweep(now);
  const { idKey, ipKey } = loginKeys(ip, loginId);
  current(idKey, now).fails += 1;
  current(ipKey, now).fails += 1;
}

export function recordLoginSuccess(ip: string, loginId: string) {
  buckets.delete(loginKeys(ip, loginId).idKey);
}

/** 테스트 전용 */
export function resetLoginThrottle() {
  buckets.clear();
}

/**
 * 프록시(Caddy)가 붙여주는 X-Forwarded-For의 첫 값을 접속지로 쓴다.
 * 헤더가 없으면 "unknown" — 이때는 모든 요청이 한 통을 쓰게 되어 서로
 * 잠그는 일이 없도록 호출부가 아이디 단위만 쓰게 한다.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}

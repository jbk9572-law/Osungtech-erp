import { getServerEnv } from "@/lib/server-env";

// 메일 계정 앱 비밀번호는 DB에 평문으로 두지 않는다 — Postgres 레이어가
// 아니라 애플리케이션 레이어(Web Crypto AES-GCM)에서 암호화해서, DB가
// 유출돼도 이 파일이 읽는 MAIL_ENCRYPTION_KEY(Cloudflare Secret, DB에는
// 없음) 없이는 복호화할 수 없게 한다. Cloudflare Workers는 Node의
// crypto 모듈 대신 표준 Web Crypto(crypto.subtle)를 쓴다.

async function getKey(): Promise<CryptoKey> {
  const raw = getServerEnv("MAIL_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error(
      "MAIL_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. Cloudflare Workers Secret으로 등록해주세요."
    );
  }
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// 저장 형식: base64(iv(12바이트) + 암호문). iv는 매 암호화마다 새로 뽑아서
// 평문 앞에 붙여 저장한다 — 복호화할 때 앞 12바이트를 다시 잘라 쓴다.
export async function encryptSecret(plainText: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return toBase64(combined);
}

export async function decryptSecret(stored: string): Promise<string> {
  const key = await getKey();
  const combined = fromBase64(stored);
  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

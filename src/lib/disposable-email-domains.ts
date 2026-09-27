// 공개 회원가입은 실제 이메일 인증 절차 없이도(사람이 매번 확인 메일을
// 열어야 하는 번거로움 없이) 최소한의 자동 방어를 걸기 위해, 알려진
// 일회용/임시 메일 도메인만 거른다 — 정상 사용자는 입력값이 하나도
// 늘지 않는다(원래 쓰던 이메일을 그대로 입력하면 통과).
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.fr",
  "getnada.com",
  "maildrop.cc",
  "mintemail.com",
  "fakeinbox.com",
  "moakt.com",
  "dispostable.com",
  "mailnesia.com",
  "mailcatch.com",
  "spamgourmet.com",
  "emailondeck.com",
  "mytemp.email",
  "tempinbox.com",
  "discard.email",
  "mailsac.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

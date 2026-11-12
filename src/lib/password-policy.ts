// 비밀번호 최소 길이 — 예전엔 "6자"가 서버 액션·폼 15곳에 각자 하드코딩돼 있어서
// 정책을 바꾸려면 15곳을 손으로 고쳐야 했다. 한 곳에서만 정하고 모두 이 값을 쓴다.
// 이미 쓰고 있는 기존 비밀번호에는 영향이 없고, 새로 만들거나 바꿀 때만 적용된다.
// (Supabase Auth 프로젝트 설정의 최소 길이도 같이 올려두면 더 확실하다.)
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_TOO_SHORT_MESSAGE = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

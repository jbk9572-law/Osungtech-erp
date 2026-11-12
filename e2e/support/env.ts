// e2e가 쓰는 환경변수를 한 곳에서 읽는다. 없으면 어떤 값이 빠졌는지 바로 알려준다.
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`e2e에 필요한 환경변수 ${name}가 없습니다 (CI에서는 GitHub 비밀값 SANDBOX_*).`);
  return v;
}

export const creds = () => ({
  email: requireEnv("E2E_EMAIL"),
  password: requireEnv("E2E_PASSWORD"),
  company: requireEnv("E2E_COMPANY"),
});

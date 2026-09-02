import { test, expect } from "@playwright/test";

// 로그인 계정 없이도 확인할 수 있는 것들 — 세션이 없는 사용자를 보호된
// 화면에서 /login으로 튕겨내는지, 로그인 폼이 제대로 뜨는지, 틀린
// 비밀번호를 넣으면 에러가 뜨는지. 실제 계정으로 로그인해 대시보드까지
// 들어가는 테스트는 authenticated.spec.ts에 있다.

test("세션 없이 보호된 화면에 들어가면 로그인 화면으로 리다이렉트된다", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("로그인 화면에 아이디/비밀번호 입력창과 로그인 버튼이 보인다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("아이디")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("틀린 계정으로 로그인하면 에러 메시지가 뜨고 /login에 남는다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("아이디").fill("no-such-account@example.com");
  await page.getByLabel("비밀번호").fill("wrong-password-000");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("로그인에 실패했습니다")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

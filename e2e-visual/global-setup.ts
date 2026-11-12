import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { requireEnv } from "../e2e/support/env";

// 한 번 로그인해서 저장한다. 두 앱(3100/3200)은 같은 localhost 쿠키를 쓰고 같은
// Supabase 세션이라 이 로그인 하나로 둘 다 통한다.
export default async function globalSetup() {
  mkdirSync("e2e-visual/.auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  await page.locator("#companyCode").fill(requireEnv("E2E_COMPANY"));
  await page.getByLabel("아이디", { exact: true }).fill(requireEnv("E2E_EMAIL"));
  await page.getByLabel("비밀번호").fill(requireEnv("E2E_PASSWORD"));
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
  await page.context().storageState({ path: "e2e-visual/.auth/state.json" });
  await browser.close();
}

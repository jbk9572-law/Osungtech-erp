import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { creds } from "./env";

// 모든 테스트가 같은 로그인 세션을 쓰도록 한 번만 로그인해서 저장한다(로그인 시도
// 횟수 제한에도 덜 걸린다).
export default async function globalSetup(config: FullConfig) {
  const { email, password, company } = creds();
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#companyCode").fill(company);
  await page.getByLabel("아이디", { exact: true }).fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
  await page.context().storageState({ path: "e2e/.auth/state.json" });
  await browser.close();
}

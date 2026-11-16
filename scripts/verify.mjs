#!/usr/bin/env node
// 작업을 끝내고 "다 됐다"고 보고하기 전에 반드시 돌리는 검사 묶음 — 개발헌법 원칙 8·9.
// lint(자동검사 전부) · 타입검사 · 테스트를 차례로 돌리고, 각각의 "종료 코드"로 통과/실패를 한 줄씩만 보여준다.
// 출력 일부만 훑어보다가 실패를 놓치는 일(실제로 있었다)을 막기 위한 것이라, 보고에는 이 결과를 그대로 인용한다.
import { spawnSync } from "node:child_process";

const STEPS = [
  ["lint(자동검사 전체)", "npm", ["run", "lint", "--silent"]],
  ["타입 검사(tsc)", "npx", ["tsc", "--noEmit"]],
  ["테스트(vitest)", "npx", ["vitest", "run"]],
];

let failed = false;
for (const [label, cmd, args] of STEPS) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "통과" : "실패"}  ${label}`);
  if (!ok) {
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split("\n");
    console.log(out.slice(-25).join("\n"));
  }
}
console.log(failed ? "\n결과: 실패 — 위 실패 항목을 고치기 전에는 '됐다'고 보고하지 않는다." : "\n결과: 전부 통과");
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// 모달(인터셉트 라우트) 로딩 화면 구조 검사.
//  1) @modal 최상위에 loading.tsx를 두면, 모달과 상관없는 일반 이동에서도 같은 칸이 바뀔 때마다 모달 모양 로딩이 번쩍인다.
//  2) 대신 각 인터셉트 폴더(@modal/(.)xxx)마다 loading.tsx가 있어야 모달이 열릴 때 로딩이 보이고, 공용
//     components/erp/modal-loading을 그대로 내보내야 모양이 한 곳에서 관리된다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modalRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "(dashboard)", "@modal");
const problems = [];

if (existsSync(path.join(modalRoot, "loading.tsx"))) {
  problems.push("@modal/loading.tsx가 있다 — 일반 이동에서 모달 모양 로딩이 번쩍인다. 각 (.)폴더의 loading.tsx로 옮기세요.");
}
const dirs = readdirSync(modalRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("(.)"));
for (const d of dirs) {
  const f = path.join(modalRoot, d.name, "loading.tsx");
  if (!existsSync(f)) {
    problems.push(`@modal/${d.name}/loading.tsx가 없다 — 이 모달이 열리는 동안 로딩 화면이 안 보인다.`);
  } else if (!readFileSync(f, "utf8").includes("@/components/erp/modal-loading")) {
    problems.push(`@modal/${d.name}/loading.tsx가 공용 modal-loading을 내보내지 않는다.`);
  }
}

if (problems.length) {
  console.error("모달 로딩 구조 위반:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`모달 로딩 구조 검사 통과 (인터셉트 폴더 ${dirs.length}개, 모두 공용 로딩 사용)`);

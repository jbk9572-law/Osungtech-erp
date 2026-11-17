// 서버에서 계정을 만드는 admin.auth.admin.createUser({...}) 호출은 회사 합류 정보를 app_metadata 로도 보내야 한다
// (lib/auth-provisioning.ts 의 provisionMetadata 를 쓰면 자동). user_metadata 만 보내면 회원가입 trigger(257)가
// "회사 정보 없음"으로 계정 생성을 거절한다 — 새 호출부를 추가하면서 빠뜨리는 실수를 막는다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full.split(path.sep).join("/"));
  }
  return out;
}

const bad = [];
for (const f of walk("src")) {
  if (f === "src/lib/auth-provisioning.ts" || f.startsWith("src/types/")) continue;
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\.createUser\(\{/g)) {
    const end = s.indexOf("});", m.index);
    const block = s.slice(m.index, end === -1 ? undefined : end);
    if (!block.includes("provisionMetadata(") && !block.includes("app_metadata")) {
      const line = s.slice(0, m.index).split("\n").length;
      bad.push(`${f}:${line}`);
    }
  }
}
if (bad.length) {
  console.error("createUser 호출에 app_metadata(회사 합류 정보)가 없습니다 — provisionMetadata({...}) 를 쓰세요:\n");
  for (const b of bad) console.error("  " + b);
  process.exit(1);
}
console.log("createUser 메타데이터 검사 통과");

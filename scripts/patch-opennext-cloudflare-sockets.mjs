// @opennextjs/cloudflare가 서버 번들을 만들 때(esbuild) "cloudflare:sockets"를
// 일반 npm 패키지처럼 resolve하려다 실패한다 — IMAP 클라이언트(imap-client.ts)와
// SMTP 발송에 쓰는 worker-mailer 패키지 둘 다 그 모듈을 정적으로 import하는데,
// esbuild external 목록에 하드코딩된 값(`./middleware/handler.mjs`)만 있고
// "cloudflare:sockets"는 빠져 있어서 매번 빌드가 실패한다(Cloudflare 배포
// "Building" 단계에서 "Could not resolve cloudflare:sockets" 에러로 확인됨).
// 이 값은 Workers 런타임이 네이티브로 제공하는 모듈이라 external로 빠져도
// 실행에는 문제없다 — @opennextjs/cloudflare가 이 목록을 설정으로 열어주지
// 않아서, npm install 직후(postinstall) node_modules 안의 해당 파일을
// 직접 고쳐준다. 패키지가 업데이트돼 이 문자열이 바뀌면 그냥 아무것도
// 안 하고 경고만 남긴다(설치 자체를 실패시키지 않는다).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetFile = path.join(
  repoRoot,
  "node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js",
);

if (!existsSync(targetFile)) {
  console.warn(`[patch-opennext-cloudflare-sockets] 대상 파일이 없어 건너뜁니다: ${targetFile}`);
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

if (original.includes('"cloudflare:sockets"')) {
  console.log("[patch-opennext-cloudflare-sockets] 이미 패치되어 있습니다.");
  process.exit(0);
}

const needle = 'external: ["./middleware/handler.mjs"]';
if (!original.includes(needle)) {
  console.warn(
    "[patch-opennext-cloudflare-sockets] 패치 대상 문구를 찾지 못했습니다 — " +
      "@opennextjs/cloudflare 버전이 바뀌었을 수 있습니다. cloudflare:sockets 관련 " +
      "빌드 실패가 다시 발생하면 이 스크립트를 새 버전에 맞게 갱신해야 합니다.",
  );
  process.exit(0);
}

const patched = original.replace(needle, 'external: ["./middleware/handler.mjs", "cloudflare:sockets"]');
writeFileSync(targetFile, patched);
console.log("[patch-opennext-cloudflare-sockets] cloudflare:sockets를 esbuild external 목록에 추가했습니다.");

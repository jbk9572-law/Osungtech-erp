#!/usr/bin/env node
// announcements/page.tsx(서버 컴포넌트)가 isThisWeek()라는 평범한 순수
// 함수를 "use client" 파일(announcement-list-body.tsx)에서 그대로
// import해서 직접 호출하고 있었다가, 실제 배포(RSC 번들링)에서만
// "Minified React error #441"로 공지사항 화면 전체가 죽는 장애가 났다.
// "use client" 파일의 export는 컴포넌트가 아니어도 서버 번들에서는 실제
// 함수가 아니라 클라이언트 레퍼런스로 치환되기 때문이다 — 로컬
// tsc/vitest는 이 변환을 거치지 않고 그냥 실행해버려서 못 잡는다
// (check-client-component-function-props.mjs가 잡는 "서버→클라이언트로
// 함수를 프롭으로 넘기는" 문제와 반대 방향: 이건 "서버가 클라이언트
// export를 직접 호출하는" 문제다).
//
// 검사 방법: 모든 .ts(x) 파일의 import 구문을 분석해서, import 대상
// 파일이 "use client" 파일인 경우 그 import한 이름이 (타입이 아니라)
// 값으로 쓰였고, import하는 쪽 파일 자체는 "use client"가 아니며(=서버
// 컴포넌트/모듈로 취급) 테스트 파일도 아닐 때(vitest는 이 변환을 거치지
// 않아 실제로 문제없이 동작한다), 그 이름이 파일 안에서 함수 호출
// 형태로(Name(...)) 쓰이면 위반으로 본다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

const ALLOWLIST = new Set([]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function isUseClientFile(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteralLike(stmt.expression)) {
      if (stmt.expression.text === "use client") return true;
      continue;
    }
    break;
  }
  return false;
}

// "@/x/y" 또는 "./x"/"../x" 형태의 import specifier를 실제 파일 경로로
// 풀어준다. .ts/.tsx 둘 다 시도하고, 못 찾으면 null.
function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) {
    base = path.join(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.join(path.dirname(fromFile), specifier);
  } else {
    return null; // 외부 패키지
  }
  for (const ext of [".tsx", ".ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(path.join(base, "index.ts"))) return path.join(base, "index.ts");
  if (existsSync(path.join(base, "index.tsx"))) return path.join(base, "index.tsx");
  return null;
}

const fileCache = new Map(); // path -> { sourceFile, isClient }

function loadFile(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const entry = { sourceFile, isClient: isUseClientFile(sourceFile) };
  fileCache.set(file, entry);
  return entry;
}

function checkFile(file) {
  const relPath = path.relative(REPO_ROOT, file);
  if (relPath.includes(".test.")) return []; // vitest는 이 변환을 거치지 않음

  const { sourceFile, isClient } = loadFile(file);
  if (isClient) return []; // 클라이언트 파일끼리는 문제없음

  const violations = [];

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const specifier = stmt.moduleSpecifier.text;
    const named = stmt.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;

    const resolved = resolveImport(file, specifier);
    if (!resolved || resolved === file) continue;
    let target;
    try {
      target = loadFile(resolved);
    } catch {
      continue;
    }
    if (!target.isClient) continue;

    for (const el of named.elements) {
      if (el.isTypeOnly) continue; // import { type X }
      const localName = el.name.text;
      // 파일 전체에서 함수 호출 형태(이름 뒤 괄호)로 쓰였는지 찾는다.
      const callRe = new RegExp("\\b" + localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
      const text = sourceFile.text;
      if (callRe.test(text)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(stmt.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          violations.push({ key, name: localName, from: path.relative(REPO_ROOT, resolved) });
        }
      }
    }
  }

  return violations;
}

const files = walkDir(SRC_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error('"use client" 파일의 export를 서버 쪽 코드에서 직접 호출:\n');
  for (const v of violations) {
    console.error(`  ${v.key}  — ${v.name}()  (from ${v.from})`);
  }
  console.error(
    "\n\"use client\" 파일에서 export한 값(컴포넌트가 아니어도)은 서버 컴포넌트/모듈에서 직접 호출할 수 없습니다 — " +
      "실제 배포에서 RSC 직렬화 에러(Minified React error #441)로 그 화면 전체가 죽습니다.",
  );
  console.error(
    "서버에서도 써야 하는 순수 함수는 \"use client\" 파일 밖, 일반 lib 파일로 옮기세요.",
  );
  process.exit(1);
} else {
  console.log(`서버→클라이언트 직접 호출 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}

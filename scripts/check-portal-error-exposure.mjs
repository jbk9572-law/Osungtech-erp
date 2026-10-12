#!/usr/bin/env node
// 헌법검사(739ebb5)에서 거래처/하청업체 포털의 서버 액션 4곳이 Postgres/RPC
// 원본 에러 메시지(error.message)를 그대로 사용자에게 돌려주고 있던 문제를
// 찾아 고쳤다. 포털(외부 사용자) 액션은 계속 늘어날 수 있는 영역이라, 같은
// 실수가 다시 생기면 사람이 또 찾아야 하므로 자동 검사로 묶는다.
//
// 검사 대상: src/app/portal/ 아래의 actions.ts 파일들.
// 검사 방법: `error.message`(error.message, err.message 등 "error"로 끝나는
// 식별자의 .message 접근)가 console.error(...) 호출 인자가 아닌 곳에
// 쓰이면 위반으로 본다 — 서버 로그로만 남기지 않고 응답(return/throw 등)에
// 그대로 흘려보낼 가능성이 있다는 뜻이다.
//
// 알려진 한계: console.error 인자인지만 구분하므로, error.message를 변수에
// 담아뒀다가 나중에 console.error에만 쓰는 2단계 패턴은 오탐(false positive)
// 날 수 있다 — 그런 경우는 ALLOWLIST에 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = path.join(__dirname, "..", "src", "app", "portal");

const ALLOWLIST = new Set([
  // "파일:줄번호" 형태로 추가하고 이유를 남긴다.
]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (entry.name === "actions.ts") {
      out.push(full);
    }
  }
  return out;
}

function isInsideConsoleErrorCall(node) {
  let current = node;
  while (current) {
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      const isConsoleError =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "console" &&
        callee.name.text === "error";
      if (isConsoleError && current.arguments.includes(findArgAncestor(current, node))) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

// node가 call의 arguments 중 어느 하나(또는 그 하위)에 속하는지 찾아, 그
// 최상위 인자 노드를 돌려준다(arguments.includes 비교용).
function findArgAncestor(call, node) {
  for (const arg of call.arguments) {
    let current = node;
    while (current) {
      if (current === arg) return arg;
      if (current === call) break;
      current = current.parent;
    }
  }
  return null;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "message" &&
      ts.isIdentifier(node.expression) &&
      /error$/i.test(node.expression.text)
    ) {
      if (!isInsideConsoleErrorCall(node)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          violations.push(key);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

if (!existsSync(PORTAL_ROOT)) {
  console.log("포털 에러 노출 검사 건너뜀 (src/app/portal 없음)");
  process.exit(0);
}

const files = walkDir(PORTAL_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error("포털 서버 액션이 Postgres/RPC 원본 에러 메시지를 그대로 노출하는 곳 발견:\n");
  for (const key of violations) {
    console.error(`  ${key}  — error.message를 console.error 밖에서 사용`);
  }
  console.error(
    "\n외부 거래처/하청업체가 접근하는 포털 화면이라, 테이블/컬럼명이 섞인 원본 에러를 그대로 보여주면 안 됩니다.",
  );
  console.error(
    "console.error(\"...실패:\", error.message)로 서버 로그에만 남기고, 응답에는 일반화된 안내 문구를 쓰세요.",
  );
  console.error("정말 필요한 경우라면 scripts/check-portal-error-exposure.mjs의 ALLOWLIST에 이유와 함께 추가하세요.");
  process.exit(1);
} else {
  console.log(`포털 에러 노출 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}

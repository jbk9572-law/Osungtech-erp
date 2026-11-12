#!/usr/bin/env node
// 품질 지표 요약 — 점수의 근거가 되는 숫자를 한눈에 본다(docs/QUALITY_SCORE.md의 기준과 짝).
// 사용: node scripts/quality-report.mjs
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const json = (f) => JSON.parse(readFileSync(path.join(here, f), "utf8"));
const inline = json("inline-style-budget.json");
const a11y = json("a11y-baseline.json");
const caps = json("file-size-caps.json");
const git = (c) => execSync(c, { cwd: path.join(here, ".."), encoding: "utf8" });
const testFiles = git("git ls-files | grep -E '\\.(test|spec)\\.tsx?$' | wc -l").trim();
const migrations = readdirSync(path.join(here, "..", "supabase", "migrations")).length;
const inlineTotal = ["spacing", "font", "color-border", "layout", "size", "other"].reduce((s, k) => s + inline[k], 0);

const rows = [
  ["UI 일관성", "직접 박은 style 선언(폭 제외)", inlineTotal, "≤ 400", "공용 클래스로 더 옮기기(erp-u-*)"],
  ["UI 일관성", "이미 클래스가 있는데 직접 쓴 값", inline.mappable, "0", "클래스로 교체"],
  ["접근성", "이름 없는 입력칸/기호 버튼/alt 없는 이미지", a11y["img-alt"] + a11y["icon-button-name"] + a11y["control-name"], "0", "aria-label/label 연결"],
  ["코드 구조", "800줄 초과 파일", Object.keys(caps).length, "≤ 5", "큰 폼/표를 모듈로 분리"],
  ["테스트", "테스트 파일 수", Number(testFiles), "늘리기", "DB 생애주기·세액 테스트 확대"],
  ["DB", "마이그레이션 수", migrations, "-", "-"],
];
console.log("영역\t지표\t현재\t목표(80점 기준)\t다음 할 일");
for (const r of rows) console.log(r.join("\t"));

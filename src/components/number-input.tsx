"use client";

import { useState } from "react";
import { evalFormula } from "@/lib/eval-formula";
import { sanitizeFormula } from "@/lib/item-formulas";

function formatNumber(value: number): string {
  // 0(=아직 입력 안 한 값)을 "0"으로 채워두면 사용자가 지우고 나서야 원하는
  // 값을 입력할 수 있었다. 0은 빈 칸으로 보여줘서 바로 원하는 숫자부터
  // 입력할 수 있게 한다.
  if (!Number.isFinite(value) || value === 0) return "";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  allowNegative = false,
  allowFormula = false,
  formula,
  onFormulaChange,
  disabled = false,
  className = "",
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  allowNegative?: boolean;
  // 엑셀처럼 "=1+1" 형태로 입력하면 포커스를 벗어날 때 계산 결과로 바뀐다.
  allowFormula?: boolean;
  // 계산식을 저장해 다시 열어도 보여주려는 화면이 넘긴다 — 식("=600*2")과 변경 알림. 값이 식의 결과와 다르면(다른 방법으로 값이 바뀜) 식은 무시한다.
  formula?: string | null;
  onFormulaChange?: (formula: string | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  // 소수점 입력 중(예: "9." -> "9.5") 매 입력마다 천단위 포맷으로 되돌리면
  // 마침표가 즉시 지워져 소수를 아예 입력할 수 없었다. 포커스 중에는 사용자가
  // 입력한 원문 그대로 보여주고, 포커스를 벗어날 때만 보기 좋게 포맷한다.
  const [text, setText] = useState(() => formatNumber(value));
  const [focused, setFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // 포커스가 없을 때 부모가 value를 바깥에서 바꾸면(예: 상품 선택으로 단가
  // 자동입력) 표시 텍스트도 같이 갱신한다.
  if (!focused && value !== prevValue) {
    setPrevValue(value);
    setText(formatNumber(value));
  }

  // 값과 맞는 식만 유효하다 — 식을 지우지 않고 값만 바뀐 경우(상품 선택으로 단가 자동입력 등)에 옛 식이 남아 보이지 않게.
  const activeFormula = formula ? sanitizeFormula(formula, value) : null;
  const input = (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      placeholder={placeholder}
      aria-label={placeholder}
      disabled={disabled}
      value={text}
      onFocus={() => {
        setFocused(true);
        // 식으로 입력한 칸은 눌렀을 때 식 그대로 보여준다 — 어떻게 계산했는지 확인·수정할 수 있게.
        if (activeFormula) setText(activeFormula);
      }}
      onBlur={() => {
        setFocused(false);
        if (allowFormula && text.trim().startsWith("=")) {
          const result = evalFormula(text.trim().slice(1));
          if (result !== null && (allowNegative || result >= 0)) {
            setText(formatNumber(result));
            onChange(result);
            onFormulaChange?.(text.trim());
            return;
          }
        }
        setText(formatNumber(value));
      }}
      onChange={(e) => {
        const rawInput = e.target.value;
        if (allowFormula && rawInput.trim().startsWith("=")) {
          // 수식 입력 중에는 그대로 보여주고, 계산은 blur 시점에 한다.
          setText(rawInput.replace(/[^0-9+\-*/().\s=]/g, ""));
          return;
        }
        const raw = allowNegative
          ? rawInput.replace(/[^0-9.,-]/g, "")
          : rawInput.replace(/[^0-9.,]/g, "");
        setText(raw);
        onChange(parseNumber(raw));
        if (formula) onFormulaChange?.(null);
      }}
      className={`text-right ${className}`}
      style={{ width: "100%" }}
    />
  );
  if (!activeFormula) return input;
  return (
    <span className="erp-fx-cell" title={`계산식 ${activeFormula} → ${formatNumber(value)}`}>
      {input}
      <span className="erp-fx-badge">fx</span>
    </span>
  );
}

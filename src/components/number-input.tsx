"use client";

import { useRef, useState } from "react";
import { CellPopover } from "@/components/erp/cell-popover";
import { useThemeFeatures } from "@/lib/erp-theme-features";
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

/** "600*2" → "600 × 2" (말풍선·창에 보여줄 식) */
function prettyFormula(expr: string): string {
  return expr.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/\s+/g, " ").trim();
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
  const { voucherLayout } = useThemeFeatures();
  const [fxRect, setFxRect] = useState<DOMRect | null>(null);
  const [expr, setExpr] = useState("");
  const fxBtnRef = useRef<HTMLButtonElement>(null);

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
  // voucherLayout 테마: 칸에 마우스를 올리면 왼쪽에 fx가 뜨고, 누르면 "=" 없이 식(600*2)을 쓰는 작은 계산창이 열린다. 식이 있는 칸은 fx가 항상 보이고 올리면 계산 내용이 말풍선으로 나온다.
  // (칸에 "=600*2"를 직접 쳐도 그대로 동작한다 — 키보드로 빠르게 입력하는 사람을 위해 남겨 둔다.)
  if (voucherLayout && allowFormula && !disabled) {
    const result = evalFormula(expr);
    const valid = result !== null && (allowNegative || result >= 0);
    const closeFx = () => {
      setFxRect(null);
      fxBtnRef.current?.focus();
    };
    const apply = () => {
      if (!valid || result === null) return;
      setText(formatNumber(result));
      setPrevValue(result);
      onChange(result);
      onFormulaChange?.(`=${expr.trim()}`);
      closeFx();
    };
    return (
      <span className="erp-fx-cell">
        {input}
        <button
          ref={fxBtnRef}
          type="button"
          tabIndex={-1}
          className={`erp-fx-btn${activeFormula ? " on" : ""}`}
          aria-label="계산식 입력(fx)"
          data-fx={activeFormula ? `${prettyFormula(activeFormula.slice(1))} → ${formatNumber(value)}` : undefined}
          onClick={() => {
            setExpr(activeFormula ? activeFormula.slice(1) : "");
            setFxRect(fxBtnRef.current?.getBoundingClientRect() ?? null);
          }}
        >
          fx
        </button>
        {fxRect && (
          <CellPopover rect={fxRect} onClose={closeFx} label="계산식 입력" width={240}>
            <label className="erp-fx-pop-label" htmlFor="erp-fx-expr">계산식 (fx)</label>
            <input
              id="erp-fx-expr"
              autoFocus
              inputMode="decimal"
              className="erp-input erp-u-w-full"
              placeholder="예: 600*2"
              value={expr}
              onChange={(e) => setExpr(e.target.value.replace(/[^0-9+\-*/().\s]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  apply();
                }
              }}
            />
            <div className={`erp-fx-pop-result${expr.trim() && !valid ? " bad" : ""}`} role="status">
              {!expr.trim() ? "더하기(+) 빼기(-) 곱하기(*) 나누기(/)를 쓸 수 있어요" : valid && result !== null ? `= ${formatNumber(result)}` : "계산할 수 없는 식입니다"}
            </div>
            <div className="erp-fx-pop-actions">
              {activeFormula && (
                <button
                  type="button"
                  className="erp-btn erp-btn-sm"
                  onClick={() => {
                    onFormulaChange?.(null);
                    closeFx();
                  }}
                >
                  식 지우기
                </button>
              )}
              <button type="button" className="erp-btn erp-btn-sm erp-btn-primary" disabled={!valid} onClick={apply}>
                적용
              </button>
            </div>
          </CellPopover>
        )}
      </span>
    );
  }
  if (!activeFormula) return input;
  return (
    <span className="erp-fx-cell" title={`계산식 ${activeFormula} → ${formatNumber(value)}`}>
      {input}
      <span className="erp-fx-badge">fx</span>
    </span>
  );
}

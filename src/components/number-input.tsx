"use client";

import { useState } from "react";

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0" : "";
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
  disabled = false,
  className = "",
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  className?: string;
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

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(formatNumber(value));
      }}
      onChange={(e) => {
        const raw = allowNegative
          ? e.target.value.replace(/[^0-9.,-]/g, "")
          : e.target.value.replace(/[^0-9.,]/g, "");
        setText(raw);
        onChange(parseNumber(raw));
      }}
      className={`text-right ${className}`}
    />
  );
}

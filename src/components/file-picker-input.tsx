"use client";

import { useRef, useState } from "react";
import { formatFileSize } from "@/lib/file-display";

// 파일 입력을 눈에 보이지 않는 input + 실제 버튼(.click() 트리거) 조합으로
// 구현한다. label로 감싸고 input을 opacity:0으로 겹쳐놓는 방식은 기기/브라우저에
// 따라 클릭이 씹히는 경우가 있어, 더 안정적인 "버튼이 숨은 input을 클릭" 방식을 쓴다.
export function FilePickerInput({
  name,
  accept,
  required,
  icon = "📁",
  label = "파일 선택",
  iconOnly = false,
  onFileChange,
}: {
  name: string;
  accept?: string;
  required?: boolean;
  icon?: string;
  label?: string;
  iconOnly?: boolean;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked ? { name: picked.name, size: picked.size } : null);
    onFileChange?.(picked);
  }

  function clear() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileChange?.(null);
  }

  return (
    <span className="erp-file-picker-group">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="erp-file-picker-hidden-input"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={iconOnly ? "erp-file-picker-btn erp-file-picker-btn-icon" : "erp-file-picker-btn"}
        title={iconOnly ? label : undefined}
      >
        {iconOnly ? icon : `${icon} ${label}`}
      </button>
      {file && (
        <span className="erp-file-picker-name">
          {file.name} · {formatFileSize(file.size)}
          <button
            type="button"
            onClick={clear}
            className="erp-file-picker-clear"
            aria-label="선택 취소"
          >
            ✕
          </button>
        </span>
      )}
    </span>
  );
}

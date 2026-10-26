"use client";

import { useRef, useState, type ReactNode } from "react";
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
  multiple = false,
  onFileChange,
}: {
  name: string;
  accept?: string;
  required?: boolean;
  // 기존 호출부(branding/signature/excel-import)는 그대로 이모지
  // 문자열을 쓰고, 선 아이콘으로 바꾼 자리(메신저)만 ReactNode를 넘긴다.
  icon?: string | ReactNode;
  label?: string;
  iconOnly?: boolean;
  // 메일쓰기처럼 여러 파일을 한 번에 첨부해야 하는 화면용 — 브라우저
  // 기본 파일칸(파일 선택/선택된 파일 없음)이 다른 화면의 버튼형
  // 피커와 톤이 달라 보이던 걸 통일한다. 네이티브 FileList는 항목
  // 하나만 골라 뺄 수 없어서(개별 제거 UI는 DataTransfer 재구성이
  // 필요해 과하다), 선택 개수만 보여주고 "전체 취소"만 지원한다.
  multiple?: boolean;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileCount, setFileCount] = useState(0);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (multiple) {
      setFileCount(e.target.files?.length ?? 0);
    } else {
      setFile(picked ? { name: picked.name, size: picked.size } : null);
    }
    onFileChange?.(picked);
  }

  function clear() {
    setFile(null);
    setFileCount(0);
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
        multiple={multiple}
        className="erp-file-picker-hidden-input"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={iconOnly ? "erp-file-picker-btn erp-file-picker-btn-icon" : "erp-file-picker-btn"}
        title={iconOnly ? label : undefined}
      >
        {iconOnly ? (
          icon
        ) : (
          <>
            {icon} {label}
          </>
        )}
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
      {multiple && fileCount > 0 && (
        <span className="erp-file-picker-name">
          파일 {fileCount}개 선택됨
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

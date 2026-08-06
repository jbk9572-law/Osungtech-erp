"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";

type StagedReceipt = {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
};

function formatKb(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

const THUMB_SIZE = 96;

// 지급결의서 작성 화면에서 영수증 사진을 여러 장 골라(또는 카메라로 연속
// 촬영해서) 스테이플러로 정리하는 순서 그대로 붙였다 뗐다 할 수 있게 하는
// 컴포넌트. 고른 즉시 브라우저에서 압축하고, name="receipts" 히든
// input에 그 결과를 실어서 폼 제출 시 서버로 같이 넘어가게 한다 —
// 실제로 전송되는 건 원본이 아니라 압축된 파일이다. 기본 <input type=file>
// 그대로 두면 "파일 선택 / 선택된 파일 없음"이라는 밋밋한 모습이라, 썸네일과
// 같은 크기의 카드형 버튼으로 대체하고 결과도 사진 그리드로 보여준다.
export function ReceiptPicker() {
  const [items, setItems] = useState<StagedReceipt[]>([]);
  const [compressing, setCompressing] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dt = new DataTransfer();
    for (const item of items) dt.items.add(item.file);
    if (hiddenInputRef.current) hiddenInputRef.current.files = dt.files;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setCompressing(true);
    try {
      const picked = Array.from(fileList);
      const compressed = await Promise.all(picked.map((file) => compressImage(file)));
      const staged: StagedReceipt[] = compressed.map((file, i) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        originalSize: picked[i].size,
      }));
      setItems((prev) => [...prev, ...staged]);
    } finally {
      setCompressing(false);
      if (pickerInputRef.current) pickerInputRef.current.value = "";
    }
  }

  function move(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(id: string) {
    setItems((prev) => {
      const found = prev.find((item) => item.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  return (
    <div className="md:col-span-3">
      <input ref={hiddenInputRef} type="file" name="receipts" multiple className="hidden" tabIndex={-1} readOnly />
      <p className="mb-2 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        여러 장을 한 번에 고르거나, 촬영 화면에서 연속으로 찍어 한 번에 추가할 수 있습니다. 스테이플러로
        묶는 순서대로 화살표로 정렬해주세요.
      </p>

      <ul className="flex flex-wrap gap-3">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="relative flex flex-col items-center gap-1 rounded-md border p-1.5 shadow-sm"
            style={{ borderColor: "var(--erp-border)", width: THUMB_SIZE + 12, background: "#fff" }}
          >
            <span
              className="absolute -left-1.5 -top-1.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ width: 18, height: 18, background: "var(--erp-primary)" }}
            >
              {index + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label="삭제"
              className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ width: 18, height: 18, background: "var(--erp-danger)", lineHeight: 1 }}
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={`영수증 ${index + 1}`}
              style={{ width: THUMB_SIZE, height: THUMB_SIZE, objectFit: "cover", borderRadius: 4 }}
            />
            <span className="text-[10px]" style={{ color: "var(--erp-text-muted)" }}>
              {formatKb(item.originalSize)} → {formatKb(item.file.size)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="erp-btn"
                style={{ padding: "1px 6px", fontSize: 11 }}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                className="erp-btn"
                style={{ padding: "1px 6px", fontSize: 11 }}
              >
                ▼
              </button>
            </div>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => pickerInputRef.current?.click()}
            disabled={compressing}
            className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed transition-colors"
            style={{
              width: THUMB_SIZE + 12,
              height: THUMB_SIZE + 44,
              borderColor: "var(--erp-border)",
              color: "var(--erp-text-muted)",
              background: "var(--erp-hover)",
            }}
          >
            {compressing ? (
              <>
                <span className="erp-spinner" aria-hidden />
                <span className="text-[11px]">압축 중...</span>
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8a2 2 0 0 1 2-2h1.2l.6-1.2A2 2 0 0 1 9.6 3.6h4.8a2 2 0 0 1 1.8 1.2L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                <span className="text-[11px] font-medium">영수증 추가</span>
              </>
            )}
          </button>
        </li>
      </ul>

      <input
        ref={pickerInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
    </div>
  );
}

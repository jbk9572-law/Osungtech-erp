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

// 지급결의서 작성 화면에서 영수증 사진을 여러 장 골라(또는 카메라로 연속
// 촬영해서) 스테이플러로 정리하는 순서 그대로 붙였다 뗐다 할 수 있게 하는
// 컴포넌트. 고른 즉시 브라우저에서 압축하고, name="receipts" 히든
// input에 그 결과를 실어서 폼 제출 시 서버로 같이 넘어가게 한다 —
// 실제로 전송되는 건 원본이 아니라 압축된 파일이다.
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
      <div className="flex items-center gap-2">
        <input
          ref={pickerInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="erp-input"
          style={{ maxWidth: 320 }}
        />
        {compressing && (
          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            <span className="erp-spinner" aria-hidden /> 압축 중...
          </span>
        )}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        여러 장을 한 번에 고르거나, 촬영 화면에서 연속으로 찍어 한 번에 추가할 수 있습니다. 스테이플러로
        묶는 순서대로 화살표로 정렬해주세요.
      </p>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-1 rounded-sm border p-2"
              style={{ borderColor: "var(--erp-border)", width: 108 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`영수증 ${index + 1}`}
                style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 4 }}
              />
              <span className="text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
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
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="erp-btn erp-btn-danger"
                  style={{ padding: "1px 6px", fontSize: 11 }}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { renderSharePages } from "@/lib/share-render";
import { dateBandLabel, shareTotals, type ShareModel } from "@/lib/share-model";

// 공유 이미지가 한 장을 넘칠 때 뜨는 미리보기 창 — 포함할 전표·품목을 체크로 고르고, 장마다 복사하거나 [모두 저장]으로 여러 파일을 받는다.
// 클립보드에는 이미지 한 장만 담을 수 있다(브라우저 한계) — 그래서 장마다 복사하거나, 저장한 파일 여러 개를 메신저 창에 한 번에 끌어놓는다.
export function ShareImagePreview({ model: initial, onClose }: { model: ShareModel; onClose: () => void }) {
  const [model, setModel] = useState(initial);
  const [urls, setUrls] = useState<string[]>([]);
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // 체크를 바꾸면 바로 다시 그린다(짧게 모아서 한 번에)
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const pages = await renderSharePages(model);
      if (cancelled) return;
      setBlobs(pages);
      setUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return pages.map((b) => URL.createObjectURL(b));
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [model]);
  useEffect(() => () => setUrls((prev) => (prev.forEach((u) => URL.revokeObjectURL(u)), [])), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = shareTotals(model);
  const toggleEntry = (i: number) =>
    setModel((m) => ({ ...m, entries: m.entries.map((e, n) => (n === i ? { ...e, include: !e.include } : e)) }));
  const toggleItem = (i: number, j: number) =>
    setModel((m) => ({
      ...m,
      entries: m.entries.map((e, n) => (n === i ? { ...e, items: e.items.map((it, k) => (k === j ? { ...it, include: !it.include } : it)) } : e)),
    }));
  const flash = (t: string) => {
    setMsg(t);
    window.setTimeout(() => setMsg(null), 2600);
  };
  async function copyPage(n: number) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobs[n] })]);
      flash(`${n + 1}장을 복사했습니다 — 메신저에 붙여넣으세요(Ctrl+V)`);
    } catch {
      flash("복사하지 못했습니다 — [모두 저장]을 써 주세요");
    }
  }
  function saveAll() {
    blobs.forEach((b, n) => {
      window.setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${model.title.replace(/[\\/:*?"<>|\s]+/g, "_")}_${n + 1}.png`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, n * 350);
    });
    flash(`${blobs.length}개 파일을 저장합니다 — 전부 선택해 메신저 창에 한 번에 끌어놓으세요`);
  }

  return createPortal(
    <div className="erp-share-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="erp-share-dialog" role="dialog" aria-modal="true" aria-label="공유 이미지 미리보기">
        <div className="erp-share-head">
          <b>공유 이미지 미리보기</b>
          <span className="erp-u-muted">
            전표 {totals.count}건 → 이미지 {blobs.length || "…"}장
          </span>
          <button type="button" className="erp-share-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="erp-share-body">
          <div className="erp-share-side">
            <h4>포함할 전표·품목</h4>
            {model.entries.map((e, i) => (
              <div key={i}>
                <label className={`erp-share-ck${e.include ? "" : " off"}`}>
                  <input type="checkbox" checked={e.include} onChange={() => toggleEntry(i)} />
                  <span>
                    {dateBandLabel(e.date).replace(/ \(.\)$/, "")} {e.party}
                  </span>
                  <small>{e.items.length}품목</small>
                </label>
                {e.items.length > 1 &&
                  e.items.map((it, j) => (
                    <label key={j} className={`erp-share-ck sub${e.include && it.include ? "" : " off"}`}>
                      <input type="checkbox" checked={it.include} disabled={!e.include} onChange={() => toggleItem(i, j)} />
                      <span>{it.name || "-"}</span>
                      <small>{it.qty}</small>
                    </label>
                  ))}
              </div>
            ))}
          </div>
          <div className="erp-share-pages">
            {urls.map((u, n) => (
              <div key={u} className="erp-share-page">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`${n + 1}장`} />
                <button type="button" className="erp-btn" onClick={() => copyPage(n)}>
                  {n + 1}장 복사
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="erp-share-foot">
          <span className="erp-u-muted">{msg ?? "장마다 복사해 순서대로 붙이거나, [모두 저장] 후 파일을 한 번에 끌어놓으세요"}</span>
          <button type="button" className="erp-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="erp-btn erp-btn-primary" onClick={saveAll} disabled={blobs.length === 0}>
            모두 저장
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

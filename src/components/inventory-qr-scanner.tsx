"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { submitStockCount } from "@/app/(dashboard)/inventory/actions";
import { FormMessage } from "@/components/form-message";
import { formatQuantityWithBoxes } from "@/lib/package-qty";
import { PageGuide } from "@/components/erp/page-guide";
import {
  createInitialScanState,
  onQrDecoded,
  confirmMismatch,
  finalizeScanSession,
  type ScanProduct,
} from "@/lib/qr-count-scan";

// 프레임마다(60fps) 디코딩을 돌리면 저사양 폰에서 카메라가 버벅이므로 잘라서
// 돈다 — 200ms(5회/초)는 안전하지만 "찍었는데 왜 안 넘어가지" 싶을 만큼
// 굼떠 보인다는 피드백이 있어 8~9회/초로 올렸다.
const SCAN_INTERVAL_MS = 120;
// 디코딩 속도를 위해 원본 해상도 대신 축소한 캔버스에서 읽는다 — 너무 작으면
// (기존 480) 카메라가 QR에서 살짝만 멀어져도 패턴을 못 읽어 재시도가 잦아져
// 오히려 느리게 느껴진다. 640으로 올려 인식 성공률 자체를 높인다.
const SCAN_CANVAS_WIDTH = 640;

export function InventoryQrScanner({
  products,
  warehouseId,
}: {
  products: ScanProduct[];
  warehouseId: string;
}) {
  const productBySku = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);
  const [scanState, setScanState] = useState(createInitialScanState);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualSku, setManualSku] = useState("");
  const [mismatchInput, setMismatchInput] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // 인식이 됐는지 안 됐는지 애매하다는 피드백 — 화면을 잠깐 색으로
  // 깜빡여서(성공은 초록, 모르는 QR은 빨강) 텍스트를 읽기 전에 바로
  // 눈에 띄게 한다. flashToken을 매번 새 값으로 바꿔 같은 종류가
  // 연달아 떠도(예: 모르는 QR을 두 번 연속) 애니메이션이 처음부터
  // 다시 재생되게 한다(React key로 DOM 자체를 새로 만듦).
  const [flash, setFlash] = useState<{ kind: "ok" | "unknown"; token: number } | null>(null);
  const lastSignatureRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 수량 정정 입력창이 열려 있는 동안은 디코딩을 멈춘다 — 안 그러면
  // 입력하는 사이에 카메라가 같은 QR을 다시 읽어 다음 품목으로 새는 걸
  // 막을 방법이 없다. 이 값을 매 렌더 중에 바로 ref에 써넣지 않고
  // useEffect로 동기화하는 이유는, 렌더 중 ref 쓰기는 리액트 규칙 위반이라서다
  // (setInterval 콜백은 렌더와 무관하게 실행되므로 effect 타이밍으로도 충분하다).
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = mismatchInput !== null || ended;
  }, [mismatchInput, ended]);

  const [state, formAction, pending] = useActionState(submitStockCount, undefined);

  // 카메라 디코딩 루프(아래 useEffect)는 마운트 시 한 번만 만들어져서 그
  // 안의 클로저가 그 시점의 productBySku를 그대로 물고 있다 — products
  // prop이 세션 중 안 바뀌는 한 문제없지만, 혹시라도 바뀌면(재검증 등)
  // 그 클로저는 계속 옛 목록을 봐서 "방금 등록/변경된 품목의 QR을
  // 스캔해도 다음으로 안 넘어가는" 것처럼 보일 수 있다. 항상 최신
  // 목록을 보게 ref로 우회한다(handleManualLookup과 동일한 방식).
  const productBySkuRef = useRef(productBySku);
  useEffect(() => {
    productBySkuRef.current = productBySku;
  }, [productBySku]);

  // scanState.active/unknownSku가 바뀔 때마다(=새로 인식됐을 때만) 플래시를
  // 띄운다. 시그니처로 한 번 더 걸러서, 같은 품목이 계속 active로 남아있는
  // 동안 다른 이유로 리렌더가 일어나도 플래시가 중복 재생되지 않게 한다.
  useEffect(() => {
    const signature = scanState.active
      ? `ok:${scanState.active.productId}`
      : scanState.unknownSku
        ? `unknown:${scanState.unknownSku}`
        : null;
    if (signature && signature !== lastSignatureRef.current) {
      const kind = scanState.active ? "ok" : "unknown";
      setFlash((prev) => ({ kind, token: (prev?.token ?? 0) + 1 }));
      if (kind === "ok" && typeof navigator.vibrate === "function") {
        navigator.vibrate(200);
      }
    }
    lastSignatureRef.current = signature;
  }, [scanState.active, scanState.unknownSku]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        intervalId = setInterval(() => {
          if (pausedRef.current) return;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
          const scale = SCAN_CANVAS_WIDTH / video.videoWidth;
          const width = SCAN_CANVAS_WIDTH;
          const height = Math.round(video.videoHeight * scale);
          if (!width || !height) return;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          const frame = ctx.getImageData(0, 0, width, height);
          const code = jsQR(frame.data, width, height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            setScanState((prev) => onQrDecoded(prev, code.data, productBySkuRef.current));
          }
        }, SCAN_INTERVAL_MS);
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? `카메라를 열 수 없습니다: ${err.message}`
            : "카메라를 열 수 없습니다.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // 카메라 스트림 자체는 한 번만 열면 되므로(재시작하면 화면이 깜빡이며
    // 다시 권한을 요청하는 것처럼 보임) 마운트 시 한 번만 실행한다.
  }, []);

  function handleManualLookup() {
    const sku = manualSku.trim().toUpperCase();
    if (!sku) return;
    setScanState((prev) => onQrDecoded(prev, sku, productBySkuRef.current));
    setManualSku("");
  }

  function handleMismatchConfirm() {
    const n = Number(mismatchInput);
    if (!Number.isFinite(n) || n < 0) return;
    setScanState((prev) => confirmMismatch(prev, n));
    setMismatchInput(null);
  }

  function handleEnd() {
    setScanState((prev) => finalizeScanSession(prev));
    setEnded(true);
  }

  const rowsPayload = JSON.stringify(
    scanState.mismatches.map((m) => ({
      productId: m.productId,
      systemQuantity: m.systemQuantity,
      countedQuantity: m.countedQuantity,
    })),
  );
  const totalScanned = scanState.confirmedIds.size;

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          aspectRatio: "3 / 4",
          background: "#000",
          borderRadius: 8,
          overflow: "hidden",
          margin: "0 auto",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {flash && (
          <div
            key={flash.token}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: flash.kind === "ok" ? "rgba(34, 197, 94, 0.45)" : "rgba(220, 38, 38, 0.45)",
              animation: "erp-scan-flash 380ms ease-out forwards",
            }}
          />
        )}

        {cameraError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              textAlign: "center",
              color: "#fff",
              background: "rgba(0,0,0,0.7)",
              fontSize: 13,
            }}
          >
            {cameraError}
          </div>
        )}

        {/* 스캔 안내 프레임 — 카메라를 켜자마자 뜨는 화면이 밋밋하다는
            피드백으로, 다른 QR/바코드 스캐너(카메라 앱, 페이 앱 등)에
            흔한 "모서리 브래킷 + 스캔 라인" 뷰파인더를 넣었다. 네 귀퉁이
            박스 섀도우 트릭(box-shadow 0 0 0 9999px)으로 사각형 밖을
            어둡게 눌러 시선을 중앙으로 모으고, 그 안에서 위아래로
            움직이는 라인이 "지금 스캔 중"이라는 걸 보여준다. */}
        {!cameraError && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "66%",
              aspectRatio: "1 / 1",
              borderRadius: 16,
              boxShadow: "0 0 0 999px rgba(0, 0, 0, 0.45)",
              pointerEvents: "none",
            }}
          >
            {[
              { top: -3, left: -3, borderTopLeftRadius: 10 },
              { top: -3, right: -3, borderTopRightRadius: 10 },
              { bottom: -3, left: -3, borderBottomLeftRadius: 10 },
              { bottom: -3, right: -3, borderBottomRightRadius: 10 },
            ].map((corner, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 30,
                  height: 30,
                  borderTop: "top" in corner ? "4px solid #4ade80" : undefined,
                  borderBottom: "bottom" in corner ? "4px solid #4ade80" : undefined,
                  borderLeft: "left" in corner ? "4px solid #4ade80" : undefined,
                  borderRight: "right" in corner ? "4px solid #4ade80" : undefined,
                  ...corner,
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                height: 2,
                borderRadius: 2,
                background: "linear-gradient(90deg, transparent, #4ade80, transparent)",
                boxShadow: "0 0 10px 2px rgba(74, 222, 128, 0.85)",
                animation: "erp-scan-line 1.8s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {!cameraError && scanState.active && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 12,
              background: "rgba(15, 20, 30, 0.82)",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{scanState.active.sku}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{scanState.active.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 8 }}>
              {scanState.active.spec ?? "-"} · 전산 재고{" "}
              <strong>
                {formatQuantityWithBoxes(scanState.active.systemQuantity, scanState.active.basePackageQty)}{" "}
                {scanState.active.unit ?? ""}
              </strong>
            </div>
            {mismatchInput === null ? (
              <button
                type="button"
                onClick={() => setMismatchInput(String(scanState.active!.systemQuantity))}
                className="erp-btn erp-btn-danger"
                style={{ width: "100%" }}
              >
                수량 다름 — 실제 수량 입력
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  autoFocus
                  value={mismatchInput}
                  onChange={(e) => setMismatchInput(e.target.value)}
                  className="erp-input"
                  style={{ flex: 1, color: "#111" }}
                />
                <button type="button" onClick={handleMismatchConfirm} className="erp-btn erp-btn-primary">
                  확정
                </button>
                <button type="button" onClick={() => setMismatchInput(null)} className="erp-btn">
                  취소
                </button>
              </div>
            )}
          </div>
        )}

        {!cameraError && !scanState.active && (
          <div
            style={{
              position: "absolute",
              top: "82%",
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: "84%",
              padding: "7px 14px",
              borderRadius: 999,
              background: scanState.unknownSku ? "rgba(220, 38, 38, 0.85)" : "rgba(0, 0, 0, 0.55)",
              color: "#fff",
              fontSize: 12.5,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {scanState.unknownSku
              ? `"${scanState.unknownSku}" 품목을 찾을 수 없습니다`
              : "사각형 안에 QR을 맞춰주세요"}
          </div>
        )}
      </div>

      <PageGuide className="mt-2 max-w-[480px] mx-auto text-center">
        QR을 비추면 자동으로 인식됩니다. 다음 품목을 이어서 스캔하면 방금 품목은 &quot;일치&quot;로
        자동 확정됩니다.
      </PageGuide>

      <div className="erp-field" style={{ marginTop: 10, maxWidth: 480, margin: "10px auto 0" }}>
        <label>카메라가 안 될 때 — SKU 직접 입력</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            autoComplete="off"
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
            className="erp-input"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={handleManualLookup} className="erp-btn">
            조회
          </button>
        </div>
      </div>

      <div
        className="erp-detail"
        style={{ marginTop: 14, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}
      >
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active" style={{ cursor: "default" }}>
            스캔 현황
          </span>
        </div>
        <div className="erp-detail-body">
          <p className="text-sm" style={{ marginBottom: scanState.mismatches.length ? 8 : 0 }}>
            총 {totalScanned}건 스캔 · 불일치 {scanState.mismatches.length}건
          </p>
          {scanState.mismatches.length > 0 && (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th className="num">전산</th>
                    <th className="num">실사</th>
                    <th className="num">차이</th>
                  </tr>
                </thead>
                <tbody>
                  {scanState.mismatches.map((m) => {
                    const product = products.find((p) => p.productId === m.productId);
                    const diff = m.countedQuantity - m.systemQuantity;
                    return (
                      <tr key={m.productId}>
                        <td>{product?.name ?? m.productId}</td>
                        <td className="num">{m.systemQuantity.toLocaleString()}</td>
                        <td className="num">{m.countedQuantity.toLocaleString()}</td>
                        <td
                          className="num"
                          style={{
                            fontWeight: 700,
                            color: diff > 0 ? "var(--erp-success)" : "var(--erp-danger)",
                          }}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <form action={formAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="warehouse_id" value={warehouseId} />
            <input type="hidden" name="rows" value={rowsPayload} />
            <input type="hidden" name="note" value="QR 자동실사" />
            <FormMessage state={state} />
            {!ended ? (
              <button type="button" onClick={handleEnd} className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
                실사 종료
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || scanState.mismatches.length === 0}
                className="erp-btn erp-btn-primary"
                style={{ width: "100%" }}
              >
                {pending
                  ? "저장 중..."
                  : scanState.mismatches.length === 0
                    ? "불일치 없음 — 저장할 내용 없음"
                    : `불일치 ${scanState.mismatches.length}건 저장`}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

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
  extractLocationCodeFromQr,
  type ScanProduct,
} from "@/lib/qr-count-scan";

type LocationStockRow = { id: string; sku: string; name: string; spec: string | null; unit: string; quantity: number };
type LocationLookup =
  | { code: string; status: "loading" }
  | { code: string; status: "done"; tier: number; position: number; rows: LocationStockRow[] }
  | { code: string; status: "error"; error: string };

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

  // 보관위치(랙) QR — 품목 QR과 같은 카메라로 찍히지만 값이 SKU가 아니라
  // 위치 상세 페이지 URL이다. 페이지 이동 없이 이 화면 안에서 그 위치의
  // 재고만 조회해 보여주고, 닫으면 하던 품목 실사를 그대로 이어간다.
  const [locationLookup, setLocationLookup] = useState<LocationLookup | null>(null);
  // setInterval 콜백에서 fetch를 매번 새로 트리거하지 않도록(같은 QR을
  // 카메라에 계속 대고 있는 동안 120ms마다 반복 조회하는 걸 막기 위해)
  // 동기적으로 즉시 확인 가능한 ref로 마지막 조회 코드를 기억한다 —
  // locationLookup state는 리렌더 이후에나 반영되어 한 박자 늦는다.
  const lastLocationCodeRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 수량 정정 입력창/위치 조회 카드가 열려 있는 동안은 디코딩을 멈춘다 —
  // 안 그러면 입력하는 사이에 카메라가 같은 QR을 다시 읽어 다음 품목으로
  // 새는 걸 막을 방법이 없다. 이 값을 매 렌더 중에 바로 ref에 써넣지 않고
  // useEffect로 동기화하는 이유는, 렌더 중 ref 쓰기는 리액트 규칙 위반이라서다
  // (setInterval 콜백은 렌더와 무관하게 실행되므로 effect 타이밍으로도 충분하다).
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = mismatchInput !== null || ended;
  }, [mismatchInput, ended]);

  function closeLocationLookup() {
    lastLocationCodeRef.current = null;
    setLocationLookup(null);
  }

  async function lookupLocation(code: string) {
    try {
      const res = await fetch(`/api/inventory/locations/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setLocationLookup({ code, status: "error", error: data.error ?? "조회에 실패했습니다." });
        return;
      }
      setLocationLookup({ code, status: "done", tier: data.tier, position: data.position, rows: data.rows });
    } catch {
      setLocationLookup({ code, status: "error", error: "조회에 실패했습니다. 네트워크 상태를 확인해주세요." });
    }
  }

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
            const locationCode = extractLocationCodeFromQr(code.data);
            if (locationCode) {
              // 같은 위치 QR을 카메라에 계속 대고 있는 동안은 다시 조회하지
              // 않는다 — 품목 QR의 "같은 값이면 아무 것도 안 바뀐다"는
              // 규칙과 동일. 다른 위치 QR로 넘어가면(랙을 옮겨 찍으면)
              // 닫기를 누를 필요 없이 바로 그 위치로 갱신된다.
              if (lastLocationCodeRef.current !== locationCode) {
                lastLocationCodeRef.current = locationCode;
                setLocationLookup({ code: locationCode, status: "loading" });
                lookupLocation(locationCode);
              }
              return;
            }
            // 위치 카드가 떠 있는 상태에서 품목 QR로 넘어가면(계속
            // 실사하려는 것), 닫기 버튼 없이도 카드를 자동으로 치우고
            // 품목 스캔을 이어간다.
            if (lastLocationCodeRef.current !== null) {
              lastLocationCodeRef.current = null;
              setLocationLookup(null);
            }
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
      {/* 앱 전체는 흰색/밝은 톤인데 카메라 화면만 어두운 박스로 뚝 떨어져
          있어 비대칭이라는 피드백 — 다른 화면 카드(.erp-detail)와 같은
          흰 패널 + 탭 헤더로 감싸 "액자"처럼 넣는다. 카메라 화면 자체
          (실시간 영상)는 밝게 바꿀 수 없지만(눈부심, 스캐너 UI 관행),
          그 주변 톤은 앱과 맞춘다. */}
      <div className="erp-detail" style={{ marginTop: 0, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active" style={{ cursor: "default" }}>
            카메라 스캔
          </span>
        </div>
        <div className="erp-detail-body">
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "3 / 4",
              // 스트림이 붙기 전 아주 짧게 보이는 로딩 배경 — 검정 대신 앱
              // 톤에 맞는 밝은 회색으로. 영상이 뜨면 objectFit:cover가 이
              // 영역을 전부 덮어서 어차피 안 보인다.
              background: "var(--erp-bg-subtle)",
              borderRadius: 6,
              border: "2px solid var(--erp-primary)",
              overflow: "hidden",
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

            {/* 스캔 안내 — 처음엔 사각형 하나를 강조하고 밖을 어둡게 눌러
                시야를 좁혔었는데(다른 스캐너 앱 관행), 카메라가 실제로 보는
                범위를 그대로 다 보고 싶다는 피드백으로 걷어냈다. 화면 전체를
                그대로 보여주고, 네 귀퉁이 브래킷 + 오가는 스캔 라인만 앱의
                메인 컬러로 살짝 얹어 "지금 스캔 중"이라는 걸 표시한다. */}
            {!cameraError && (
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {[
                  { top: 10, left: 10, borderTopLeftRadius: 10 },
                  { top: 10, right: 10, borderTopRightRadius: 10 },
                  { bottom: 10, left: 10, borderBottomLeftRadius: 10 },
                  { bottom: 10, right: 10, borderBottomRightRadius: 10 },
                ].map((corner, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 34,
                      height: 34,
                      opacity: 0.9,
                      borderTop: "top" in corner ? "4px solid var(--erp-primary)" : undefined,
                      borderBottom: "bottom" in corner ? "4px solid var(--erp-primary)" : undefined,
                      borderLeft: "left" in corner ? "4px solid var(--erp-primary)" : undefined,
                      borderRight: "right" in corner ? "4px solid var(--erp-primary)" : undefined,
                      ...corner,
                    }}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    top: "45%",
                    height: 2,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, transparent, var(--erp-primary), transparent)",
                    boxShadow: "0 0 10px 2px rgba(74, 111, 165, 0.85)",
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
                    {formatQuantityWithBoxes(
                      scanState.active.systemQuantity,
                      scanState.active.basePackageQty,
                      scanState.active.unit ?? "",
                    )}
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
                  bottom: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  maxWidth: "84%",
                  padding: "7px 14px",
                  borderRadius: 999,
                  // 원래는 검정 반투명(rgba(0,0,0,*)) 칩이었는데, 앱 전체가
                  // 밝은 톤이라 화면 안에 검은 요소가 남는 게 튄다는 피드백 —
                  // 색을 빼고 반투명 유리 느낌(blur)만 남겼다. 모르는 QR을
                  // 읽었을 때는 의미 전달을 위해 빨강 톤만 옅게 남긴다.
                  background: scanState.unknownSku ? "rgba(220, 38, 38, 0.35)" : "rgba(255, 255, 255, 0.16)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  border: `1px solid ${scanState.unknownSku ? "rgba(220, 38, 38, 0.5)" : "rgba(255, 255, 255, 0.35)"}`,
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
                  fontSize: 12.5,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {scanState.unknownSku
                  ? `"${scanState.unknownSku}" 품목을 찾을 수 없습니다`
                  : "QR을 화면 안에 비춰주세요"}
              </div>
            )}

            {/* 보관위치(랙) QR을 찍으면 위치 화면으로 이동하지 않고 이
                자리에서 재고만 보여준다 — 진행 중인 품목 실사(스캔한
                불일치 목록 등)를 그대로 유지한 채, 닫으면 다시 이어서
                스캔할 수 있게 하기 위해서다. */}
            {locationLookup && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15, 20, 30, 0.92)",
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>
                    보관 위치 {locationLookup.code}
                    {locationLookup.status === "done" && (
                      <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.75, marginLeft: 6 }}>
                        ({locationLookup.tier === 2 ? "2단" : "1단"}·
                        {locationLookup.position === 1 ? "좌측" : "우측"})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeLocationLookup}
                    className="erp-btn erp-btn-danger"
                    style={{ flexShrink: 0 }}
                  >
                    닫기
                  </button>
                </div>

                <div style={{ flex: 1, overflow: "auto" }}>
                  {locationLookup.status === "loading" && (
                    <p style={{ fontSize: 12.5, opacity: 0.85 }}>조회 중...</p>
                  )}
                  {locationLookup.status === "error" && (
                    <p style={{ fontSize: 12.5, color: "#ffb4b4" }}>{locationLookup.error}</p>
                  )}
                  {locationLookup.status === "done" && locationLookup.rows.length === 0 && (
                    <p style={{ fontSize: 12.5, opacity: 0.85 }}>이 위치에 등록된 품목이 없습니다.</p>
                  )}
                  {locationLookup.status === "done" && locationLookup.rows.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ opacity: 0.75 }}>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>품목</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>규격</th>
                          <th style={{ textAlign: "right", padding: "4px 6px" }}>수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locationLookup.rows.map((row) => (
                          <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                            <td style={{ padding: "6px" }}>{row.name}</td>
                            <td style={{ padding: "6px", opacity: 0.85 }}>{row.spec ?? "-"}</td>
                            <td style={{ padding: "6px", textAlign: "right" }}>
                              {formatQuantityWithBoxes(row.quantity, null, row.unit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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

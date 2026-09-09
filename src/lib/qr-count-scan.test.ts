import { describe, expect, it } from "vitest";
import {
  createInitialScanState,
  onQrDecoded,
  confirmMismatch,
  finalizeScanSession,
  extractLocationCodeFromQr,
  setActiveLocation,
  type ScanProduct,
} from "./qr-count-scan";

const productA: ScanProduct = {
  productId: "p1",
  sku: "SKU-A",
  name: "크라프트지 98",
  spec: "788*1090",
  unit: "매",
  systemQuantity: 117,
  basePackageQty: null,
};
const productB: ScanProduct = {
  productId: "p2",
  sku: "SKU-B",
  name: "필터 R3",
  spec: "450*250",
  unit: "EA",
  systemQuantity: 300,
  basePackageQty: 50,
};

function bySku(...products: ScanProduct[]) {
  return new Map(products.map((p) => [p.sku, p]));
}

describe("onQrDecoded", () => {
  it("shows the scanned product as active", () => {
    const state = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    expect(state.active).toEqual(productA);
    expect(state.confirmedIds.size).toBe(0);
  });

  it("re-scanning the same code again does nothing (debounced)", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA, productB));
    const s2 = onQrDecoded(s1, "SKU-A", bySku(productA, productB));
    expect(s2).toBe(s1);
  });

  it("scanning a different product auto-confirms the previous one as matched", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA, productB));
    const s2 = onQrDecoded(s1, "SKU-B", bySku(productA, productB));
    expect(s2.active).toEqual(productB);
    expect(s2.confirmedIds.has("p1")).toBe(true);
    expect(s2.mismatches).toEqual([]);
  });

  it("an unrecognized code surfaces as unknownSku while still confirming the one left behind", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = onQrDecoded(s1, "GARBAGE", bySku(productA));
    expect(s2.active).toBeNull();
    expect(s2.unknownSku).toBe("GARBAGE");
    expect(s2.confirmedIds.has("p1")).toBe(true); // SKU-A was still auto-confirmed on leaving it
  });

  it("does not double-count a product scanned twice non-consecutively", () => {
    let state = createInitialScanState();
    state = onQrDecoded(state, "SKU-A", bySku(productA, productB));
    state = onQrDecoded(state, "SKU-B", bySku(productA, productB));
    state = onQrDecoded(state, "SKU-A", bySku(productA, productB)); // re-scan A
    state = finalizeScanSession(state);
    expect(state.confirmedIds.size).toBe(2); // only A and B, not 3
  });
});

describe("confirmMismatch", () => {
  it("records a mismatch with the actual counted quantity and clears active", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = confirmMismatch(s1, 90);
    expect(s2.active).toBeNull();
    expect(s2.mismatches).toEqual([
      { productId: "p1", systemQuantity: 117, countedQuantity: 90, locationCode: null },
    ]);
    expect(s2.confirmedIds.has("p1")).toBe(true);
  });

  it("does nothing when there is no active product", () => {
    const state = createInitialScanState();
    expect(confirmMismatch(state, 5)).toBe(state);
  });

  it("re-confirming the same product replaces the earlier mismatch instead of adding a second one", () => {
    let state = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    state = confirmMismatch(state, 90); // 잘못 입력
    state = onQrDecoded(state, "SKU-A", bySku(productA)); // 다시 스캔해서 정정
    state = confirmMismatch(state, 80); // 실제 정정값
    expect(state.mismatches).toEqual([
      { productId: "p1", systemQuantity: 117, countedQuantity: 80, locationCode: null },
    ]);
  });

  it("stamps the currently active location onto the mismatch", () => {
    let state = setActiveLocation(createInitialScanState(), { code: "A1-02-01" });
    state = onQrDecoded(state, "SKU-A", bySku(productA));
    state = confirmMismatch(state, 90);
    expect(state.mismatches).toEqual([
      { productId: "p1", systemQuantity: 117, countedQuantity: 90, locationCode: "A1-02-01" },
    ]);
  });

  it("scanning a product QR does not clear the active location", () => {
    let state = setActiveLocation(createInitialScanState(), { code: "A1-02-01" });
    state = onQrDecoded(state, "SKU-A", bySku(productA, productB));
    state = onQrDecoded(state, "SKU-B", bySku(productA, productB));
    expect(state.activeLocation).toEqual({ code: "A1-02-01" });
  });

  it("keeps corrections for the same product at two different locations separate", () => {
    let state = setActiveLocation(createInitialScanState(), { code: "RACK-1" });
    state = onQrDecoded(state, "SKU-A", bySku(productA));
    state = confirmMismatch(state, 50);
    state = setActiveLocation(state, { code: "RACK-2" });
    state = onQrDecoded(state, "SKU-A", bySku(productA));
    state = confirmMismatch(state, 20);
    expect(state.mismatches).toEqual([
      { productId: "p1", systemQuantity: 117, countedQuantity: 50, locationCode: "RACK-1" },
      { productId: "p1", systemQuantity: 117, countedQuantity: 20, locationCode: "RACK-2" },
    ]);
  });
});

describe("finalizeScanSession", () => {
  it("confirms the still-active product as matched when the session ends", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = finalizeScanSession(s1);
    expect(s2.confirmedIds.size).toBe(1);
    expect(s2.confirmedIds.has("p1")).toBe(true);
  });
});

describe("extractLocationCodeFromQr", () => {
  it("extracts the location code from a full location URL", () => {
    expect(extractLocationCodeFromQr("https://erp.example.com/inventory/locations/A1-02-01")).toBe(
      "A1-02-01",
    );
  });

  it("extracts the code even with a trailing slash or query string", () => {
    expect(extractLocationCodeFromQr("https://erp.example.com/inventory/locations/A1-02-01/")).toBe(
      "A1-02-01",
    );
    expect(extractLocationCodeFromQr("https://erp.example.com/inventory/locations/A1-02-01?x=1")).toBe(
      "A1-02-01",
    );
  });

  it("returns null for a plain product SKU (not a URL)", () => {
    expect(extractLocationCodeFromQr("SKU-A")).toBeNull();
  });

  it("returns null for the locations list URL (no code segment)", () => {
    expect(extractLocationCodeFromQr("https://erp.example.com/inventory/locations")).toBeNull();
  });
});

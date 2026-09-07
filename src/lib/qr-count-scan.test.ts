import { describe, expect, it } from "vitest";
import {
  createInitialScanState,
  onQrDecoded,
  confirmMismatch,
  finalizeScanSession,
  type ScanProduct,
} from "./qr-count-scan";

const productA: ScanProduct = {
  productId: "p1",
  sku: "SKU-A",
  name: "크라프트지 98",
  spec: "788*1090",
  unit: "매",
  systemQuantity: 117,
};
const productB: ScanProduct = {
  productId: "p2",
  sku: "SKU-B",
  name: "필터 R3",
  spec: "450*250",
  unit: "EA",
  systemQuantity: 300,
};

function bySku(...products: ScanProduct[]) {
  return new Map(products.map((p) => [p.sku, p]));
}

describe("onQrDecoded", () => {
  it("shows the scanned product as active", () => {
    const state = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    expect(state.active).toEqual(productA);
    expect(state.matchedCount).toBe(0);
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
    expect(s2.matchedCount).toBe(1);
    expect(s2.confirmedIds.has("p1")).toBe(true);
    expect(s2.mismatches).toEqual([]);
  });

  it("an unrecognized code surfaces as unknownSku without advancing matchedCount", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = onQrDecoded(s1, "GARBAGE", bySku(productA));
    expect(s2.active).toBeNull();
    expect(s2.unknownSku).toBe("GARBAGE");
    expect(s2.matchedCount).toBe(1); // SKU-A was still auto-confirmed on leaving it
  });

  it("does not double-count a product scanned twice non-consecutively", () => {
    let state = createInitialScanState();
    state = onQrDecoded(state, "SKU-A", bySku(productA, productB));
    state = onQrDecoded(state, "SKU-B", bySku(productA, productB));
    state = onQrDecoded(state, "SKU-A", bySku(productA, productB)); // re-scan A
    state = finalizeScanSession(state);
    expect(state.matchedCount).toBe(2); // only A and B, not 3
  });
});

describe("confirmMismatch", () => {
  it("records a mismatch with the actual counted quantity and clears active", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = confirmMismatch(s1, 90);
    expect(s2.active).toBeNull();
    expect(s2.mismatches).toEqual([{ productId: "p1", systemQuantity: 117, countedQuantity: 90 }]);
    expect(s2.confirmedIds.has("p1")).toBe(true);
  });

  it("does nothing when there is no active product", () => {
    const state = createInitialScanState();
    expect(confirmMismatch(state, 5)).toBe(state);
  });
});

describe("finalizeScanSession", () => {
  it("confirms the still-active product as matched when the session ends", () => {
    const s1 = onQrDecoded(createInitialScanState(), "SKU-A", bySku(productA));
    const s2 = finalizeScanSession(s1);
    expect(s2.matchedCount).toBe(1);
    expect(s2.confirmedIds.has("p1")).toBe(true);
  });
});

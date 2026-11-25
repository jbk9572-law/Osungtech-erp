import { describe, expect, it } from "vitest";
import { dateBandLabel, parseAmount, roleOfLabel, shareTotals, type ShareModel } from "./share-model";

describe("공유 이미지 재료", () => {
  it("날짜 띠: 요일을 붙이고, 읽을 수 없는 형식은 그대로", () => {
    expect(dateBandLabel("2026. 11. 16.")).toBe("11월 16일 (월)");
    expect(dateBandLabel("11.16 이월")).toBe("11.16 이월");
  });
  it("열 이름 → 품목 항목(품명·규격·수량·단가·금액·세액·비고)", () => {
    expect(roleOfLabel("품목명 / 적요")).toBe("name");
    expect(roleOfLabel("공급가")).toBe("price");
    expect(roleOfLabel("공급가액")).toBe("amount");
    expect(roleOfLabel("전표번호")).toBeNull();
    expect(roleOfLabel("출고처")).toBeNull();
  });
  it("금액 읽기", () => {
    expect(parseAmount("7,591,100")).toBe(7591100);
    expect(parseAmount("-")).toBeNull();
  });
  it("합계는 포함된 전표·품목만, 수량은 단위별로", () => {
    const item = (q: string, a: string, include = true) => ({ name: "x", spec: "", lot: "", qty: q, price: "", amount: a, tax: "", remark: "", include });
    const model: ShareModel = {
      title: "t",
      today: "2026.11.25",
      roles: ["name", "qty", "amount"],
      entries: [
        { date: "", party: "A", docNo: "", extras: [], include: true, items: [item("225 ROLL", "6,367,500"), item("532 KG", "1,223,600"), item("9 KG", "100", false)] },
        { date: "", party: "B", docNo: "", extras: [], include: false, items: [item("1 EA", "1,000")] },
        { date: "", party: "C", docNo: "", extras: [], include: true, items: [item("100 KG", "230,000")] },
      ],
    };
    const t = shareTotals(model);
    expect(t.count).toBe(2);
    expect(t.amount).toBe(7821100);
    expect(t.qtyLabel).toBe("225 ROLL · 632 KG");
  });
  it("금액 열을 고르지 않았으면 합계 금액을 만들지 않는다", () => {
    const m: ShareModel = { title: "t", today: "", roles: ["name", "qty"], entries: [] };
    expect(shareTotals(m).amount).toBeNull();
  });
});

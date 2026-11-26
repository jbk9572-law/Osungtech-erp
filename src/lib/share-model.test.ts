import { describe, expect, it } from "vitest";
import { dateBandLabel, isDateHead, isPartyHead, parseAmount, roleOfLabel, shareTotals, type ShareModel } from "./share-model";

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
      recognized: true,
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
    const m: ShareModel = { title: "t", today: "", roles: ["name", "qty"], entries: [], recognized: true };
    expect(shareTotals(m).amount).toBeNull();
  });
  it("매입 목록의 '매입일자'도 날짜 열로, '거래처코드'·'공급처코드'는 거래처 열이 아니다", () => {
    expect(isDateHead("거래일자")).toBe(true);
    expect(isDateHead("매입일자")).toBe(true);
    expect(isPartyHead("출고처")).toBe(true);
    expect(isPartyHead("공급처")).toBe(true);
    expect(isPartyHead("거래처코드")).toBe(false);
    expect(isPartyHead("공급처코드")).toBe(false);
  });
  it("한 칸에 단위가 섞여 있어도(이월 줄 '225 ROLL · 532 KG') 단위별로 합친다", () => {
    const item = (q: string) => ({ name: "x", spec: "", lot: "", qty: q, price: "", amount: "", tax: "", remark: "", include: true });
    const m: ShareModel = { title: "t", today: "", roles: ["name", "qty"], recognized: true, entries: [{ date: "", party: "A", docNo: "", extras: [], include: true, items: [item("225 ROLL · 532 KG"), item("100 KG")] }] };
    expect(shareTotals(m).qtyLabel).toBe("225 ROLL · 632 KG");
  });
  it("반품(−금액)은 합계에서 빠진다", () => {
    const item = (a: string) => ({ name: "x", spec: "", lot: "", qty: "", price: "", amount: a, tax: "", remark: "", include: true });
    const m: ShareModel = { title: "t", today: "", roles: ["name", "amount"], recognized: true, entries: [{ date: "", party: "A", docNo: "", extras: [], include: true, items: [item("1,000"), item("-300")] }] };
    expect(shareTotals(m).amount).toBe(700);
  });
});

describe("공유 이미지 같은 품명 묶기 (groupRowsByName)", () => {
  const item = (name: string, spec: string): import("@/lib/share-model").ShareItem => ({ name, spec, lot: "", qty: "1 EA", price: "", amount: "", tax: "", remark: "", include: true });
  const kinds = (rows: import("@/lib/share-model").ShareRow[]) => rows.map((r) => (r.kind === "head" ? `H:${r.name}` : `${r.kind === "sub" ? "S" : "-"}:${r.it.spec}`));

  it("입력 순서상 이어진 같은 품명 2줄 이상은 품명 한 번 + 규격 줄들로 묶는다", async () => {
    const { groupRowsByName } = await import("@/lib/share-model");
    const rows = groupRowsByName([item("P.P", "250"), item("P.P", "125"), item("P.P", "0.5"), item("SMC", "750"), item("SMC", "500")]);
    expect(kinds(rows)).toEqual(["H:P.P", "S:250", "S:125", "S:0.5", "H:SMC", "S:750", "S:500"]);
  });

  it("중간에 다른 품명이 끼면 입력 순서를 지키려고 묶지 않는다", async () => {
    const { groupRowsByName } = await import("@/lib/share-model");
    const rows = groupRowsByName([item("P.P", "250"), item("SMC", "750"), item("P.P", "125")]);
    expect(kinds(rows)).toEqual(["-:250", "-:750", "-:125"]);
  });

  it("품명이 비었거나 '-'이면 묶지 않고, 한 줄짜리는 그대로 둔다", async () => {
    const { groupRowsByName } = await import("@/lib/share-model");
    expect(kinds(groupRowsByName([item("", "a"), item("", "b"), item("-", "c"), item("-", "d")]))).toEqual(["-:a", "-:b", "-:c", "-:d"]);
    expect(kinds(groupRowsByName([item("X", "1")]))).toEqual(["-:1"]);
    expect(groupRowsByName([])).toEqual([]);
  });
});

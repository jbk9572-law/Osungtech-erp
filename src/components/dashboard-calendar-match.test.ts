import { describe, expect, it } from "vitest";
import {
  buildDestinationPool,
  groupProductItemsByLabel,
  sortSpecsByTrailingNumber,
  type ItemRow,
  type ProductGroup,
} from "./dashboard-calendar";

let seq = 0;
function row(overrides: Partial<ItemRow> = {}): ItemRow {
  seq += 1;
  return {
    partnerName: "명진화학",
    productName: "크라프트지 98",
    categoryName: "Material",
    spec: "788*1090",
    unit: "매",
    quantity: 100,
    basePackageQty: null,
    amount: 100000,
    orderId: `order-${seq}`,
    remark: null,
    isCarryover: false,
    isReturn: false,
    ...overrides,
  };
}

function group(items: ItemRow[]): ProductGroup {
  return { productName: items[0].productName, items };
}

describe("groupProductItemsByLabel — 카테고리 게이트", () => {
  it("Filter 카테고리면 매입 쪽 목적지 매칭을 하지 않고 한 그룹으로 합친다", () => {
    const purchased = [row({ categoryName: "Filter", quantity: 100, partnerName: "분필타셈유한산업" })];
    const soldToday = buildDestinationPool([
      row({ categoryName: "Filter", partnerName: "명진화학", quantity: 60 }),
    ]);
    const groups = groupProductItemsByLabel(group(purchased), soldToday, undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it("Filter 카테고리면 매출 쪽 재고분 체크도 하지 않는다", () => {
    const sold = [row({ categoryName: "Filter", quantity: 100 })];
    const purchasedToday = buildDestinationPool([row({ categoryName: "Filter", quantity: 0 })]);
    const groups = groupProductItemsByLabel(group(sold), undefined, purchasedToday);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it("카테고리가 아예 없으면(null) 안전하게 미추적으로 취급한다", () => {
    const purchased = [row({ categoryName: null, quantity: 100 })];
    const soldToday = buildDestinationPool([row({ categoryName: null, partnerName: "명진화학", quantity: 60 })]);
    const groups = groupProductItemsByLabel(group(purchased), soldToday, undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it.each(["Paper", "Material", "Tray", "Bobbin", "Etc"])(
    "%s 카테고리는 Filter가 아니므로 추적 대상이다",
    (categoryName) => {
      const purchased = [row({ categoryName, quantity: 100 })];
      const soldToday = buildDestinationPool([row({ categoryName, partnerName: "명진화학", quantity: 100 })]);
      const groups = groupProductItemsByLabel(group(purchased), soldToday, undefined);
      expect(groups[0].label).toBe("명진화학");
    },
  );
});

describe("groupProductItemsByLabel — 매입(원재료), 목적지 추적", () => {
  it("전량 한 거래처로 나갔으면 그 거래처명이 라벨이 된다", () => {
    const purchased = [row({ quantity: 100 })];
    const soldToday = buildDestinationPool([row({ partnerName: "명진화학", quantity: 100 })]);
    const groups = groupProductItemsByLabel(group(purchased), soldToday, undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("명진화학");
  });

  it("일부만 나가고 나머지는 재고면(실제 거래처가 하나뿐이라) 그 한 줄에 남은재고 메모만 붙는다", () => {
    // destinationsIncludingStock이 실제 거래처를 하나라도 찾으면, 그 남는
    // 몫은 별도 그룹이 아니라 마지막 실제 거래처 줄의 note로만 표시된다
    // (groupProductItemsByLabel 주석 참고) — 여러 거래처로 쪼개질 때만
    // "재고용 매입" 그룹이 별도로 생긴다(destinations 중 real이 0개일 때).
    const purchased = [row({ quantity: 100 })];
    const soldToday = buildDestinationPool([row({ partnerName: "명진화학", quantity: 30 })]);
    const groups = groupProductItemsByLabel(group(purchased), soldToday, undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("명진화학");
    expect(groups[0].items[0].note).toBe("70매는 출고 후 남은재고");
  });
});

describe("groupProductItemsByLabel — 매출(원재료), 매입처 추적", () => {
  it("오늘 산 게 없으면 재고분출고로 표시된다", () => {
    const sold = [row({ quantity: 50 })];
    const groups = groupProductItemsByLabel(group(sold), undefined, buildDestinationPool([]));
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("재고분 출고");
  });

  it("당일 매입 한 곳에서 전량 커버되면 '매입처 -> 출고처' 라벨이 붙는다", () => {
    const sold = [row({ partnerName: "명진화학", quantity: 50 })];
    const purchasedToday = buildDestinationPool([row({ partnerName: "분필타셈유한산업", quantity: 100 })]);
    const groups = groupProductItemsByLabel(group(sold), undefined, purchasedToday);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("분필타셈유한산업 -> 명진화학");
  });

  it("당일 매입 여러 공급처에서 나눠 커버되면 공급처별로 줄이 나뉜다", () => {
    const sold = [row({ partnerName: "명진화학", quantity: 100 })];
    const purchasedToday = buildDestinationPool([
      row({ partnerName: "A공급처", quantity: 80 }),
      row({ partnerName: "B공급처", quantity: 30 }),
    ]);
    const groups = groupProductItemsByLabel(group(sold), undefined, purchasedToday);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("A공급처 -> 명진화학");
    expect(groups[0].items.reduce((s, i) => s + i.item.quantity, 0)).toBe(80);
    expect(groups[1].label).toBe("B공급처 -> 명진화학");
    expect(groups[1].items.reduce((s, i) => s + i.item.quantity, 0)).toBe(20);
  });

  it("일부는 당일 매입, 나머지는 재고면 매입처 라벨 + 재고분출고가 같이 나온다", () => {
    const sold = [row({ partnerName: "명진화학", quantity: 100 })];
    const purchasedToday = buildDestinationPool([row({ partnerName: "분필타셈유한산업", quantity: 40 })]);
    const groups = groupProductItemsByLabel(group(sold), undefined, purchasedToday);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("분필타셈유한산업 -> 명진화학");
    expect(groups[0].items.reduce((s, i) => s + i.item.quantity, 0)).toBe(40);
    expect(groups[1].label).toBe("재고분 출고");
    expect(groups[1].items.reduce((s, i) => s + i.item.quantity, 0)).toBe(60);
  });

  it("반품 건은 매입처 매칭 대상에서 제외된다", () => {
    const sold = [row({ quantity: 20, isReturn: true })];
    const purchasedToday = buildDestinationPool([row({ quantity: 100 })]);
    const groups = groupProductItemsByLabel(group(sold), undefined, purchasedToday);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });
});

describe("sortSpecsByTrailingNumber", () => {
  it("* 뒤쪽 숫자가 같은 규격끼리 묶이고, 뒤쪽 숫자 오름차순으로 정렬된다", () => {
    const specs = ["1㎛ * 250mm", "1㎛ * 500mm", "1㎛ * 750mm", "5㎛ * 500mm", "25㎛ * 750mm", "100㎛ * 500mm"];
    expect(sortSpecsByTrailingNumber(specs)).toEqual([
      "1㎛ * 250mm",
      "1㎛ * 500mm",
      "5㎛ * 500mm",
      "100㎛ * 500mm",
      "1㎛ * 750mm",
      "25㎛ * 750mm",
    ]);
  });

  it("규격 중 하나라도 '숫자 * 숫자' 형태가 아니면 원래 순서 그대로 둔다", () => {
    const specs = ["1㎛ * 250mm", "규격 미지정"];
    expect(sortSpecsByTrailingNumber(specs)).toEqual(specs);
  });
});

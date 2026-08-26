import { describe, expect, it } from "vitest";
import { groupByProductKey } from "./group-by-product";

type Row = { name: string; qty: number; amount: number };

describe("groupByProductKey", () => {
  it("groups rows sharing the same key and sums quantity/amount", () => {
    const rows: Row[] = [
      { name: "A", qty: 1, amount: 100 },
      { name: "B", qty: 2, amount: 200 },
      { name: "A", qty: 3, amount: 300 },
    ];
    const groups = groupByProductKey(
      rows,
      (r) => r.name,
      (r) => r.qty,
      (r) => r.amount,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "A",
      totalQuantity: 4,
      totalAmount: 400,
    });
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      key: "B",
      totalQuantity: 2,
      totalAmount: 200,
    });
  });

  it("preserves first-occurrence order of keys", () => {
    const rows: Row[] = [
      { name: "B", qty: 1, amount: 1 },
      { name: "A", qty: 1, amount: 1 },
      { name: "B", qty: 1, amount: 1 },
    ];
    const groups = groupByProductKey(
      rows,
      (r) => r.name,
      (r) => r.qty,
      (r) => r.amount,
    );
    expect(groups.map((g) => g.key)).toEqual(["B", "A"]);
  });

  it("returns an empty array for no rows", () => {
    expect(
      groupByProductKey<Row>(
        [],
        (r) => r.name,
        (r) => r.qty,
        (r) => r.amount,
      ),
    ).toEqual([]);
  });
});

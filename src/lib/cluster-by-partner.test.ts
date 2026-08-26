import { describe, expect, it } from "vitest";
import {
  clusterByDominantPartner,
  type Clusterable,
} from "./cluster-by-partner";

type Item = Clusterable & { name: string };

describe("clusterByDominantPartner", () => {
  it("places items sharing the same dominant out-partner next to each other", () => {
    const items: Item[] = [
      {
        name: "A",
        totalAmount: 100,
        outPartners: [{ id: "customer1", amount: 100 }],
      },
      {
        name: "B",
        totalAmount: 80,
        outPartners: [{ id: "customer2", amount: 80 }],
      },
      {
        name: "C",
        totalAmount: 50,
        outPartners: [{ id: "customer1", amount: 50 }],
      },
    ];
    const result = clusterByDominantPartner(items);
    expect(result.map((i) => i.name)).toEqual(["A", "C", "B"]);
  });

  it("orders clusters by combined total amount, descending", () => {
    const items: Item[] = [
      {
        name: "small",
        totalAmount: 10,
        outPartners: [{ id: "x", amount: 10 }],
      },
      { name: "big1", totalAmount: 60, outPartners: [{ id: "y", amount: 60 }] },
      { name: "big2", totalAmount: 60, outPartners: [{ id: "y", amount: 60 }] },
    ];
    const result = clusterByDominantPartner(items);
    // y-cluster totals 120 > x-cluster's 10, so it comes first
    expect(result.map((i) => i.name)).toEqual(["big1", "big2", "small"]);
  });

  it("uses the highest-amount out-partner as the dominant one when there are several", () => {
    const items: Item[] = [
      {
        name: "multi",
        totalAmount: 90,
        outPartners: [
          { id: "minor", amount: 10 },
          { id: "major", amount: 80 },
        ],
      },
      {
        name: "matches-major",
        totalAmount: 40,
        outPartners: [{ id: "major", amount: 40 }],
      },
    ];
    const result = clusterByDominantPartner(items);
    expect(result.map((i) => i.name)).toEqual(["multi", "matches-major"]);
  });

  it("keeps items with no out-partners as independent, unmerged clusters", () => {
    const items: Item[] = [
      { name: "inbound-only-1", totalAmount: 30, outPartners: [] },
      { name: "inbound-only-2", totalAmount: 20, outPartners: [] },
    ];
    const result = clusterByDominantPartner(items);
    expect(result.map((i) => i.name)).toEqual([
      "inbound-only-1",
      "inbound-only-2",
    ]);
  });
});

export type PartnerAmount = { id: string; amount: number };

export type Clusterable = {
  totalAmount: number;
  outPartners: PartnerAmount[];
};

function dominantPartnerId(outPartners: PartnerAmount[]): string | null {
  let best: PartnerAmount | null = null;
  for (const p of outPartners) {
    if (!best || p.amount > best.amount) best = p;
  }
  return best?.id ?? null;
}

// 월별 리포트처럼 "품목별로 묶어서" 보여주는 목록을, 단순히 품목 하나의
// 거래금액 순으로 정렬하면 같은 출고처로 나가는 품목끼리도 다른 품목을
// 사이에 두고 떨어져 보인다. 품목마다 제일 비중 큰 출고처(dominant
// partner)를 기준으로 묶어서, 같은 출고처가 주력인 품목들이 서로 붙어
// 나오게 한다. 출고처가 없는(순수 매입 전용) 품목은 각자 독립된 묶음으로
// 취급해 기존 순서를 그대로 유지한다.
export function clusterByDominantPartner<T extends Clusterable>(
  items: T[],
): T[] {
  const clusters = new Map<string, { items: T[]; totalAmount: number }>();
  let soloCounter = 0;
  for (const item of items) {
    const partnerId = dominantPartnerId(item.outPartners);
    const key = partnerId ? `p:${partnerId}` : `solo:${soloCounter++}`;
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { items: [], totalAmount: 0 };
      clusters.set(key, cluster);
    }
    cluster.items.push(item);
    cluster.totalAmount += item.totalAmount;
  }

  const orderedClusters = Array.from(clusters.values());
  orderedClusters.sort((a, b) => b.totalAmount - a.totalAmount);
  for (const cluster of orderedClusters) {
    cluster.items.sort((a, b) => b.totalAmount - a.totalAmount);
  }
  return orderedClusters.flatMap((c) => c.items);
}

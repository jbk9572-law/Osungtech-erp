"use client";

import { useRouter, usePathname } from "next/navigation";

// 재고실사/QR자동실사처럼 서버 컴포넌트가 창고별로 다른 무거운 조회를
// 다시 계산해야 하는 화면에서 쓴다 — 클라이언트 상태로 재계산하는 대신
// 쿼리 파라미터(?warehouseId=)를 바꿔 페이지 자체를 그 창고 기준으로
// 다시 렌더링한다. 창고가 1개뿐이면 호출하는 쪽에서 아예 렌더하지 않는다.
export function WarehouseQuerySelect({
  warehouses,
  value,
}: {
  warehouses: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      aria-label="창고"
      value={value}
      onChange={(e) => router.push(`${pathname}?warehouseId=${e.target.value}`)}
      className="erp-input"
      style={{ width: "auto" }}
    >
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}

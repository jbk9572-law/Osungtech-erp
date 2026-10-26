// usage-widget.tsx(플랫폼 전체 인프라 현황)와 settings/billing(테넌트별
// 쿼터 현황)이 둘 다 "바이트를 MB로 보여주는" 같은 포맷을 각자 가지고
// 있었다 — 공용 함수로 묶는다.
export function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

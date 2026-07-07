export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 200,
        color: "var(--erp-text-muted)",
        fontSize: 12.5,
      }}
    >
      조회 중...
    </div>
  );
}

import { MaintenanceScreen } from "@/components/erp/maintenance-screen";
import { getMaintenanceFlag } from "@/lib/maintenance";

// 점검 중일 때 proxy가 모든 화면 요청을 이 화면으로 바꿔 보여 준다(503). 평소에는 직접 열어도 안내만 보일 뿐 아무 영향이 없다.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const flag = await getMaintenanceFlag();
  return <MaintenanceScreen message={flag.message} />;
}

import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function ThemeSettingsPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 화면 테마" />

      <PageGuide>
        이 브라우저에서 보이는 화면 톤을 고릅니다. 이 기기에만 저장되고(다른 로그인/기기에는 영향 없음), 선택하는
        즉시 전체 메뉴에 바로 반영됩니다.
      </PageGuide>

      <FormSection tabLabel="테마 선택">
        <ThemeSwitcher />
      </FormSection>
    </div>
  );
}

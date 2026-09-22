import Link from "next/link";

// 개인정보처리방침. 개인정보보호위원회 "개인정보 처리방침 작성지침"의
// 표준 항목(수집 항목/목적/보유기간/파기/제3자 제공/위탁/정보주체
// 권리/안전성 확보조치/쿠키/보호책임자/권익침해 구제방법)을 전부
// 포함한다. [ ] 표시는 실제 운영 정보(사업자등록번호/대표자/주소/
// 개인정보보호책임자 연락처)가 정해지면 반드시 채워 넣어야 하는
// 자리다 — 그 정보 없이는 법적 문서로서 완전하지 않다.
const EFFECTIVE_DATE = "2026년 9월 22일";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-[#182338]">
      <h1 className="mb-2 text-xl font-bold">엘보닉스(ELVONIX) 개인정보처리방침</h1>
      <p className="mb-8 text-xs text-[#6b7280]">시행일: {EFFECTIVE_DATE}</p>

      <p className="mb-6">
        [운영자 상호명](이하 &quot;회사&quot;)는 개인정보보호법 등 관계 법령을 준수하며, 이용자의 개인정보
        보호에 최선을 다하고 있습니다. 회사는 본 개인정보처리방침을 통해 이용자가 제공하는 개인정보가
        어떠한 목적과 방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고 있는지
        알려드립니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
        <p className="mb-2">회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>필수 항목(계정 생성 시): 아이디, 비밀번호, 이름, 소속 회사(테넌트)</li>
          <li>선택 항목: 이메일, 연락처, 직급/직책, 부서</li>
          <li>서비스 이용 과정에서 자동 수집: 접속 로그, 접속 IP, 서비스 이용기록, GPS 위치 정보(근태 출퇴근 체크 시, 위치 권한을 허용한 경우에 한함)</li>
        </ul>
        <p className="mt-2">수집 방법: 서비스 내 계정 생성(관리자 등록) 및 이용 과정에서의 자동 수집</p>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 식별 및 서비스 로그인 인증</li>
          <li>매출·매입·인사·근태 등 업무관리 서비스 제공</li>
          <li>고객지원 및 문의 응대</li>
          <li>서비스 부정이용 방지 및 보안 강화</li>
          <li>서비스 개선 및 신규 기능 개발을 위한 통계 분석(개인을 식별할 수 없는 형태로 가공)</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>
          회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후 또는 이용계약(테넌트) 해지 시 해당
          정보를 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 아래와 같이
          일정 기간 보관합니다.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>계약 또는 청약철회 등에 관한 기록: 5년(전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년(전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>접속 로그 기록: 3개월(통신비밀보호법)</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 파기절차 및 방법">
        <p>
          전자적 파일 형태로 저장된 개인정보는 복구 및 재생이 불가능한 기술적 방법을 사용하여
          삭제하며, 종이 문서에 기록·저장된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <p>
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에 동의한
          경우, 또는 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의
          요구가 있는 경우는 예외로 합니다.
        </p>
      </Section>

      <Section title="6. 개인정보 처리업무의 위탁">
        <p className="mb-2">회사는 서비스 제공을 위해 아래와 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>수탁업체: Supabase Inc. — 위탁업무: 데이터베이스 및 인증 인프라 운영</li>
          <li>수탁업체: Cloudflare, Inc. — 위탁업무: 애플리케이션 호스팅 및 네트워크 인프라 운영</li>
        </ul>
        <p className="mt-2">
          회사는 위탁계약 체결 시 개인정보보호법 제26조에 따라 위탁업무 수행 목적 외 개인정보 처리금지,
          기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독 등을 계약서 등 문서에 명시하고
          있습니다.
        </p>
      </Section>

      <Section title="7. 정보주체의 권리·의무 및 행사방법">
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·수정하거나 처리 정지 및 삭제를 요청할 수 있습니다.
          서비스 내 [환경설정 &gt; 계정 관리] 또는 아래 개인정보보호책임자 연락처를 통해 요청할 수 있으며,
          회사는 지체 없이 필요한 조치를 취합니다.
        </p>
      </Section>

      <Section title="8. 개인정보의 안전성 확보조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>비밀번호는 암호화하여 저장·관리하며, 본인만 알 수 있도록 합니다.</li>
          <li>테넌트(회사) 간 데이터는 데이터베이스 접근제어 정책으로 격리되어 다른 회사의 데이터에 접근할 수 없습니다.</li>
          <li>개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고 있습니다.</li>
          <li>정기적인 자체 점검을 통해 개인정보 취급 관련 안정성을 확보하고 있습니다.</li>
        </ul>
      </Section>

      <Section title="9. 쿠키(Cookie)의 운용 및 거부">
        <p>
          회사는 로그인 상태 유지 등 서비스 이용 편의를 위해 브라우저의 localStorage 등 저장소를 사용할 수
          있습니다. 이는 웹서버가 이용자의 브라우저에 보내는 소량의 정보이며, 이용자는 브라우저 설정을
          통해 저장을 거부할 수 있습니다. 다만 저장을 거부할 경우 로그인 정보 저장 등 일부 서비스 이용에
          어려움이 있을 수 있습니다.
        </p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
        <div className="rounded border border-[#e2e5eb] p-3">
          <p>성명: [개인정보보호책임자 성명]</p>
          <p>직책: [직책]</p>
          <p>연락처: [전화번호] / [이메일 주소]</p>
        </div>
        <p className="mt-2">
          이용자는 서비스를 이용하며 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한
          사항을 개인정보 보호책임자 및 담당부서로 문의할 수 있습니다.
        </p>
      </Section>

      <Section title="11. 권익침해 구제방법">
        <p className="mb-2">
          개인정보 침해로 인한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보분쟁조정위원회: 1833-6972 (kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청 사이버범죄수사단: 1301 (spo.go.kr)</li>
          <li>경찰청 사이버수사국: 182 (ecrm.police.go.kr)</li>
        </ul>
      </Section>

      <Section title="12. 고지의 의무">
        <p>
          현 개인정보처리방침의 내용 추가, 삭제 및 수정이 있을 경우 개정 최소 7일 전부터 서비스 내
          공지사항을 통해 고지합니다. 다만 개인정보의 수집 및 활용, 제3자 제공 등과 같이 이용자 권리의
          중요한 변경이 있을 경우 최소 30일 전에 고지합니다.
        </p>
      </Section>

      <Section title="부칙">
        <p>이 개인정보처리방침은 {EFFECTIVE_DATE}부터 시행합니다.</p>
      </Section>

      <p className="mt-10 text-xs text-[#6b7280]">
        <Link href="/terms" className="underline">
          이용약관
        </Link>
        도 함께 확인해주세요.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <div className="text-[#3b4658]">{children}</div>
    </section>
  );
}

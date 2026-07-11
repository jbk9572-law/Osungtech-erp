import { SNS_LINES, SNS_FILLS } from "./sns-lines";
import { ZENITH_LINES, ZENITH_FILLS } from "./zenith-lines";
import { KT_LINES, KT_FILLS } from "./kt-lines";
import { PAGE_W, PAGE_H, FONT, pt, dash, Fill, Line, T, TCenter, TRight, type Company } from "./shared";

type Item = {
  id: string;
  category: string;
  spec: string;
  sku: string;
  unit: string;
  quantity: number;
  basePackageQty: number | null;
  remark?: string | null;
  // 케이이티솔루션 전용: 이 거래처는 "규격" 입력칸에 실제 규격 대신 배치/롯
  // 관리번호(예: 260521 - 101)를 적기 때문에, 인쇄 시 규격은 품목 마스터의
  // 고정 규격을 보여주고 관리번호는 이 값으로 따로 보여준다.
  lotNo?: string | null;
};

// 품목 영역 좌표 (모든 출고증 서식 공통, 실측 확인됨).
const CATEGORY_X0 = 75.36;
const CATEGORY_X1 = 158.64;
const CATEGORY_CENTER = (CATEGORY_X0 + CATEGORY_X1) / 2;
const SUM_LABEL_CENTER = (CATEGORY_X0 + 278.64) / 2;
const SPEC_X = 187.8;
const COL_B_CENTER = (278.64 + 387.48) / 2;
const COL_C_CENTER = (387.48 + 460.92) / 2;
const ROW_TOP0 = 238.28;
const ROW_H = 16.68;
const ROW_COUNT = 27;

export function SnsFiltechCanvas({
  company,
  customerName,
  customerAddress,
  customerContactName,
  customerContactPhone,
  orderDate,
  items,
  note,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
}) {
  const blankCount = Math.max(0, ROW_COUNT - items.length);
  const rows = [
    ...items,
    ...Array.from({ length: blankCount }).map((_, i) => ({
      id: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      spec: "",
      sku: "",
      unit: "",
      quantity: 0,
      basePackageQty: null as number | null,
    })),
  ];

  // 연속된 같은 대분류(품명)는 세로로 병합해서 그 구간 중앙에 한 번만 표시한다.
  const groups: { category: string; start: number; count: number }[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].category === rows[i].category) j++;
    groups.push({ category: rows[i].category, start: i, count: j - i });
    i = j;
  }

  const totalBox = items.reduce((sum, it) => sum + it.quantity, 0);
  const totalEa = items.reduce((sum, it) => sum + it.quantity * (it.basePackageQty ?? 0), 0);

  return (
    <div style={{ position: "relative", width: pt(PAGE_W), height: pt(PAGE_H), fontFamily: FONT }}>
      {SNS_FILLS.map((f, i) => (
        <Fill key={i} {...f} />
      ))}
      {SNS_LINES.map((l, i) => (
        <Line key={i} {...l} />
      ))}

      {/* 제목 / 거래처 귀하 */}
      <T x={161.04} y={78.38} size={12} bold>
        거래명세표 (출고)
      </T>
      <TRight right={534.48} y={78.38} size={12} bold>
        {customerName}&nbsp;&nbsp;귀하
      </TRight>

      {/* 공급자(우리 회사) 정보 - 항상 고정 */}
      <T x={99.36} y={104.09} size={9}>등록번호</T>
      <T x={216.48} y={104.09} size={9}>{dash(company?.business_number)}</T>
      <T x={103.92} y={119.81} size={9}>공급자</T>
      <T x={168.84} y={120.29} size={9}>{dash(company?.name)}</T>
      <T x={244.19} y={120.29} size={9}>성명</T>
      <T x={297.83} y={120.29} size={9}>{dash(company?.representative_name)}</T>
      <T x={99.36} y={135.53} size={9}>전화번호</T>
      <T x={164.64} y={136.01} size={9}>{dash(company?.phone)}</T>
      <T x={235.16} y={136.01} size={9}>팩스번호</T>
      <T x={283.04} y={136.01} size={9}>{dash(company?.fax_number)}</T>
      <T x={108.12} y={151.25} size={9}>업태</T>
      <T x={173.04} y={151.73} size={9} width={50}>{dash(company?.business_type)}</T>
      <T x={243.98} y={151.73} size={9}>종목</T>
      <T x={291.5} y={151.73} size={9} width={48}>{dash(company?.business_item)}</T>
      <T x={93.36} y={175.61} size={9}>사업장 주소</T>
      <T x={162.84} y={168.77} size={9} width={166}>{dash(company?.address)}</T>

      {/* 공급받는자(거래처) 정보 */}
      <T x={356.76} y={119.81} size={9}>주소</T>
      <T x={389.76} y={112.97} size={9} width={144}>{dash(customerAddress)}</T>
      <T x={352.32} y={159.17} size={9}>담당자</T>
      <T x={415.2} y={151.25} size={9}>{customerContactPhone ? `Tel : ${customerContactPhone}` : "-"}</T>
      <T x={430.44} y={166.97} size={9}>{customerContactName || ""}</T>
      <T x={386.28} y={183.41} size={9} bold>출고일 :</T>
      <T x={474.48} y={183.89} size={9} bold>{new Date(orderDate).toLocaleDateString("sv-SE")}</T>

      {/* 품목 헤더 */}
      <T x={107.4} y={213.8} size={9.96} bold>품명</T>
      <T x={209.29} y={213.8} size={9.96} bold>규격</T>
      <TCenter centerX={COL_B_CENTER} y={213.8} size={9.96} bold>수량 (box)</TCenter>
      <TCenter centerX={COL_C_CENTER} y={213.8} size={9.96} bold>수량</TCenter>
      <T x={488.88} y={213.8} size={9.96} bold>비고</T>

      {/* 품목 대분류(세로 병합) */}
      {groups.map((g) => {
        const groupTop = ROW_TOP0 + g.start * ROW_H;
        const groupHeight = g.count * ROW_H;
        return (
          <TCenter key={g.start} centerX={CATEGORY_CENTER} y={groupTop + groupHeight / 2 - 6} size={9.96}>
            {g.category}
          </TCenter>
        );
      })}

      {/* 품목 행 */}
      {rows.map((row, i) => {
        const y = ROW_TOP0 + i * ROW_H;
        const total = row.basePackageQty != null ? row.quantity * row.basePackageQty : null;
        return (
          <div key={row.id}>
            <T x={SPEC_X} y={y} size={9.96}>{row.spec}</T>
            {row.quantity > 0 && (
              <TCenter centerX={COL_B_CENTER} y={y} size={9.96}>
                {row.quantity.toLocaleString()} {row.unit || "Box"}
              </TCenter>
            )}
            {total != null && total > 0 && (
              <TCenter centerX={COL_C_CENTER} y={y} size={9.96}>
                {total.toLocaleString()}
              </TCenter>
            )}
          </div>
        );
      })}

      {note && (
        <T x={SPEC_X} y={ROW_TOP0 + ROW_COUNT * ROW_H + 4} size={9} width={340}>
          {note}
        </T>
      )}

      {/* 합계 행 */}
      <TCenter centerX={SUM_LABEL_CENTER} y={688.04} size={9.96}>합계</TCenter>
      <TCenter centerX={COL_B_CENTER} y={688.04} size={9.96}>{totalBox.toLocaleString()} Box</TCenter>
      <TCenter centerX={COL_C_CENTER} y={688.52} size={9.96}>{totalEa.toLocaleString()} Ea</TCenter>

      {/* 하단 도장란 */}
      <T x={102.48} y={730.4} size={9.96} bold>공급자</T>
      <TRight right={278.64 - 8} y={730.4} size={9.96}>(인)</TRight>
      <TCenter centerX={201.84} y={732.72} size={9}>㈜오성테크</TCenter>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none opacity-90 mix-blend-multiply"
        style={{ position: "absolute", left: pt(243), top: pt(722.88), width: pt(33.12), height: pt(30.24) }}
      />
      <T x={319.08} y={730.4} size={9.96} bold>인수자</T>
      <TRight right={534.48 - 8} y={730.4} size={9.96}>(인)</TRight>
    </div>
  );
}

// 제니스테크 출고증 좌표 (실측).
const Z_SPEC_X = 174.0;
const Z_UNIT_CENTER = (278.64 + 387.48) / 2;
const Z_EA_RIGHT = 458;
const Z_REMARK_X = 488.89;
const Z_ROW_TOP0 = 238.08;
const Z_ROW_H = 16.68;
const Z_ROW_COUNT = 25;
const Z_NOTE_CENTER = (159 + 534.48) / 2;

export function ZenithTechCanvas({
  company,
  customerName,
  customerAddress,
  customerContactName,
  customerContactPhone,
  orderDate,
  items,
  note,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
}) {
  const blankCount = Math.max(0, Z_ROW_COUNT - items.length);
  const rows = [
    ...items,
    ...Array.from({ length: blankCount }).map((_, i) => ({
      id: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      spec: "",
      sku: "",
      unit: "",
      quantity: 0,
      basePackageQty: null as number | null,
      remark: null as string | null,
    })),
  ];

  // 연속된 같은 대분류(품명)는 세로로 병합해서 그 구간 중앙에 한 번만 표시한다.
  const groups: { category: string; start: number; count: number }[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].category === rows[i].category) j++;
    groups.push({ category: rows[i].category, start: i, count: j - i });
    i = j;
  }

  // 제니스테크 서식은 박스 단위 없이 합계(Ea) 값을 그대로 수량으로 쓴다.
  const totalEa = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div style={{ position: "relative", width: pt(PAGE_W), height: pt(PAGE_H), fontFamily: FONT }}>
      {ZENITH_FILLS.map((f, i) => (
        <Fill key={i} {...f} />
      ))}
      {ZENITH_LINES.map((l, i) => (
        <Line key={i} {...l} />
      ))}

      {/* 제목 / 거래처 귀하 */}
      <T x={161.04} y={78.38} size={12} bold>
        거래명세표 (출고)
      </T>
      <TRight right={534.48} y={78.38} size={12} bold>
        {customerName}&nbsp;&nbsp;귀하
      </TRight>

      {/* 공급자(우리 회사) 정보 - 항상 고정 */}
      <T x={99.36} y={104.09} size={9}>등록번호</T>
      <T x={216.48} y={104.09} size={9}>{dash(company?.business_number)}</T>
      <T x={103.92} y={119.81} size={9}>공급자</T>
      <T x={168.84} y={120.29} size={9}>{dash(company?.name)}</T>
      <T x={244.19} y={120.29} size={9}>성명</T>
      <T x={297.83} y={120.29} size={9}>{dash(company?.representative_name)}</T>
      <T x={99.36} y={135.53} size={9}>전화번호</T>
      <T x={164.64} y={136.01} size={9}>{dash(company?.phone)}</T>
      <T x={235.16} y={136.01} size={9}>팩스번호</T>
      <T x={283.04} y={136.01} size={9}>{dash(company?.fax_number)}</T>
      <T x={108.12} y={151.25} size={9}>업태</T>
      <T x={173.04} y={151.73} size={9} width={50}>{dash(company?.business_type)}</T>
      <T x={243.98} y={151.73} size={9}>종목</T>
      <T x={291.5} y={151.73} size={9} width={48}>{dash(company?.business_item)}</T>
      <T x={93.36} y={175.61} size={9}>사업장 주소</T>
      <T x={162.84} y={168.77} size={9} width={166}>{dash(company?.address)}</T>

      {/* 공급받는자(거래처) 정보 */}
      <T x={356.76} y={119.81} size={9}>주소</T>
      <T x={405.24} y={119.81} size={9} width={140}>{dash(customerAddress)}</T>
      <T x={352.32} y={159.17} size={9}>담당자</T>
      <T x={415.2} y={151.25} size={9}>{customerContactPhone ? `Tel : ${customerContactPhone}` : "-"}</T>
      <T x={430.44} y={166.97} size={9}>{customerContactName || ""}</T>
      <T x={386.28} y={183.41} size={9} bold>출고일 :</T>
      <T x={474.48} y={183.89} size={9} bold>{new Date(orderDate).toLocaleDateString("sv-SE")}</T>

      {/* 품목 헤더 */}
      <T x={107.4} y={213.8} size={9.96} bold>품명</T>
      <T x={209.29} y={213.8} size={9.96} bold>규격</T>
      <TCenter centerX={Z_UNIT_CENTER} y={213.8} size={9.96} bold>단위</TCenter>
      <TRight right={Z_EA_RIGHT} y={213.8} size={9.96} bold>합계 (Ea)</TRight>
      <T x={488.86} y={213.8} size={9.96} bold>비고</T>

      {/* 품목 대분류(세로 병합) */}
      {groups.map((g) => {
        const groupTop = Z_ROW_TOP0 + g.start * Z_ROW_H;
        const groupHeight = g.count * Z_ROW_H;
        return (
          <TCenter key={g.start} centerX={CATEGORY_CENTER} y={groupTop + groupHeight / 2 + 9} size={9.96}>
            {g.category}
          </TCenter>
        );
      })}

      {/* 품목 행 */}
      {rows.map((row, i) => {
        const y = Z_ROW_TOP0 + i * Z_ROW_H;
        return (
          <div key={row.id}>
            <T x={Z_SPEC_X} y={y} size={9.96}>{row.spec}</T>
            {row.spec && (
              <TCenter centerX={Z_UNIT_CENTER} y={y} size={9.96}>{row.unit}</TCenter>
            )}
            {row.quantity > 0 && (
              <TRight right={Z_EA_RIGHT} y={y} size={9.96}>{row.quantity.toLocaleString()}</TRight>
            )}
            {row.remark && <T x={Z_REMARK_X} y={y} size={9.96}>{row.remark}</T>}
          </div>
        );
      })}

      {note && (
        <TCenter centerX={Z_NOTE_CENTER} y={664.16} size={9.96} bold>
          {note}
        </TCenter>
      )}

      {/* 합계 행 */}
      <T x={222.12} y={689.36} size={9.96}>합계</T>
      <TRight right={Z_EA_RIGHT} y={689.84} size={9.96}>{totalEa.toLocaleString()}</TRight>

      {/* 하단 도장란 */}
      <T x={102.48} y={732.08} size={9.96} bold>공급자</T>
      <TRight right={278.64 - 8} y={732.08} size={9.96}>(인)</TRight>
      <TCenter centerX={201.84} y={734.4} size={9}>㈜오성테크</TCenter>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none opacity-90 mix-blend-multiply"
        style={{ position: "absolute", left: pt(243), top: pt(724.56), width: pt(33.12), height: pt(30.24) }}
      />
      <T x={319.08} y={732.08} size={9.96} bold>인수자</T>
      <TRight right={534.48 - 8} y={732.08} size={9.96}>(인)</TRight>
    </div>
  );
}

// 케이이티솔루션 출고증 좌표 (실측).
const KT_SPEC_X = 168.24;
const KT_LOT_CENTER = (278.64 + 387.48) / 2;
const KT_QTY_CENTER = (387.48 + 460.92) / 2;
const KT_REMARK_X = 488.88;
const KT_ROW_TOP0 = 238.28;
const KT_ROW_H = 16.68;
const KT_ROW_COUNT = 27;

export function KtSolutionCanvas({
  company,
  customerName,
  customerAddress,
  customerContactName,
  customerContactPhone,
  orderDate,
  items,
  note,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
}) {
  const blankCount = Math.max(0, KT_ROW_COUNT - items.length);
  const rows = [
    ...items,
    ...Array.from({ length: blankCount }).map((_, i) => ({
      id: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      spec: "",
      sku: "",
      unit: "",
      quantity: 0,
      basePackageQty: null as number | null,
      remark: null as string | null,
      lotNo: null as string | null,
    })),
  ];

  // 연속된 같은 대분류(품명)는 세로로 병합해서 그 구간 중앙에 한 번만 표시한다.
  const groups: { category: string; start: number; count: number }[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].category === rows[i].category) j++;
    groups.push({ category: rows[i].category, start: i, count: j - i });
    i = j;
  }

  // 케이이티솔루션 서식은 개별 행 수량(RL 등 실단위)의 합계를 박스 환산 단위로 보여준다.
  const totalBox = items.reduce((sum, it) => {
    if (it.basePackageQty) return sum + it.quantity / it.basePackageQty;
    return sum;
  }, 0);

  return (
    <div style={{ position: "relative", width: pt(PAGE_W), height: pt(PAGE_H), fontFamily: FONT }}>
      {KT_FILLS.map((f, i) => (
        <Fill key={i} {...f} />
      ))}
      {KT_LINES.map((l, i) => (
        <Line key={i} {...l} />
      ))}

      {/* 제목 / 거래처 귀하 */}
      <T x={161.04} y={78.38} size={12} bold>
        거래명세표 (출고)
      </T>
      <TRight right={534.48} y={78.38} size={12} bold>
        {customerName}&nbsp;&nbsp;귀하
      </TRight>

      {/* 공급자(우리 회사) 정보 - 항상 고정 */}
      <T x={99.36} y={104.09} size={9}>등록번호</T>
      <T x={216.48} y={104.09} size={9}>{dash(company?.business_number)}</T>
      <T x={103.92} y={119.81} size={9}>공급자</T>
      <T x={168.84} y={120.29} size={9}>{dash(company?.name)}</T>
      <T x={244.19} y={120.29} size={9}>성명</T>
      <T x={297.83} y={120.29} size={9}>{dash(company?.representative_name)}</T>
      <T x={99.36} y={135.53} size={9}>전화번호</T>
      <T x={164.64} y={136.01} size={9}>{dash(company?.phone)}</T>
      <T x={235.16} y={136.01} size={9}>팩스번호</T>
      <T x={283.04} y={136.01} size={9}>{dash(company?.fax_number)}</T>
      <T x={108.12} y={151.25} size={9}>업태</T>
      <T x={173.04} y={151.73} size={9} width={50}>{dash(company?.business_type)}</T>
      <T x={243.98} y={151.73} size={9}>종목</T>
      <T x={291.5} y={151.73} size={9} width={48}>{dash(company?.business_item)}</T>
      <T x={93.36} y={175.61} size={9}>사업장 주소</T>
      <T x={162.84} y={168.77} size={9} width={166}>{dash(company?.address)}</T>

      {/* 공급받는자(거래처) 정보 */}
      <T x={356.76} y={119.81} size={9}>주소</T>
      <T x={392.67} y={119.81} size={9} width={140}>{dash(customerAddress)}</T>
      <T x={352.32} y={159.17} size={9}>담당자</T>
      <T x={415.2} y={151.25} size={9}>{customerContactPhone ? `Tel : ${customerContactPhone}` : "-"}</T>
      <T x={430.44} y={166.97} size={9}>{customerContactName || ""}</T>
      <T x={386.28} y={183.41} size={9} bold>출고일 :</T>
      <T x={474.48} y={183.89} size={9} bold>{new Date(orderDate).toLocaleDateString("sv-SE")}</T>

      {/* 품목 헤더 */}
      <T x={107.4} y={213.8} size={9.96} bold>품명</T>
      <T x={209.29} y={213.8} size={9.96} bold>규격</T>
      <TCenter centerX={KT_LOT_CENTER} y={213.8} size={9.96} bold>관리번호</TCenter>
      <TCenter centerX={KT_QTY_CENTER} y={213.8} size={9.96} bold>수량</TCenter>
      <T x={488.88} y={213.8} size={9.96} bold>비고</T>

      {/* 품목 대분류(세로 병합) */}
      {groups.map((g) => {
        const groupTop = KT_ROW_TOP0 + g.start * KT_ROW_H;
        const groupHeight = g.count * KT_ROW_H;
        return (
          <TCenter
            key={g.start}
            centerX={CATEGORY_CENTER}
            y={groupTop + groupHeight / 2 - 15}
            size={9.96}
            width={76}
          >
            {g.category}
          </TCenter>
        );
      })}

      {/* 품목 행 */}
      {rows.map((row, i) => {
        const y = KT_ROW_TOP0 + i * KT_ROW_H;
        return (
          <div key={row.id}>
            <T x={KT_SPEC_X} y={y} size={9.96}>{row.spec}</T>
            {row.spec && (
              <TCenter centerX={KT_LOT_CENTER} y={y} size={9.96}>{row.lotNo || "-"}</TCenter>
            )}
            {row.quantity > 0 && (
              <TCenter centerX={KT_QTY_CENTER} y={y} size={9.96}>
                {row.quantity.toLocaleString()} {row.unit || ""}
              </TCenter>
            )}
            {row.remark && <T x={KT_REMARK_X} y={y} size={9.96}>{row.remark}</T>}
          </div>
        );
      })}

      {note && (
        <T x={KT_SPEC_X} y={KT_ROW_TOP0 + KT_ROW_COUNT * KT_ROW_H + 4} size={9} width={340}>
          {note}
        </T>
      )}

      {/* 합계 행 */}
      <T x={222.12} y={688.04} size={9.96}>합계</T>
      <TCenter centerX={KT_QTY_CENTER} y={688.52} size={9.96}>{Math.round(totalBox).toLocaleString()} box</TCenter>

      {/* 하단 도장란 */}
      <T x={102.48} y={729.92} size={9.96} bold>공급자</T>
      <TRight right={278.64 - 8} y={729.92} size={9.96}>(인)</TRight>
      <TCenter centerX={201.84} y={732.24} size={9}>㈜오성테크</TCenter>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none opacity-90 mix-blend-multiply"
        style={{ position: "absolute", left: pt(243), top: pt(722.4), width: pt(33.12), height: pt(30.24) }}
      />
      <T x={319.08} y={729.92} size={9.96} bold>인수자</T>
      <TRight right={534.48 - 8} y={729.92} size={9.96}>(인)</TRight>
    </div>
  );
}

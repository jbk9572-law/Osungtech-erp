# Osungtech ERP

Next.js (App Router) + Supabase 기반 재고관리 ERP 초기 스캐폴드입니다.

## 스택

- Next.js 16 (App Router, Server Actions)
- React 19
- Tailwind CSS 4
- Supabase (Auth, Postgres, RLS)

## 프로젝트 구조

```
src/
  app/
    login/              로그인 페이지 + Server Action
    signup/             회원가입 페이지 + Server Action
    (dashboard)/         인증 필요 라우트 그룹 (사이드바 레이아웃)
      dashboard/         요약 대시보드
      products/          상품 관리
      inventory/         창고별 재고 현황
      transactions/      입출고 등록/이력
      suppliers/         공급업체 관리
      warehouses/        창고 관리
  components/
    sidebar.tsx
    header.tsx
  lib/supabase/
    client.ts            브라우저용 Supabase 클라이언트
    server.ts             서버 컴포넌트/액션용 Supabase 클라이언트
    proxy.ts              세션 갱신 및 인증 가드 로직
  proxy.ts                Next.js 16 Proxy 진입점 (구 middleware.ts)
  types/database.types.ts Supabase 테이블 타입 정의
supabase/
  migrations/             스키마 및 RLS 정책 SQL
  config.toml             Supabase CLI 로컬 개발 설정
```

> Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었습니다. 인증 세션 갱신 및
> 비로그인 사용자 리다이렉트는 `src/proxy.ts` → `src/lib/supabase/proxy.ts`에서 처리합니다.

## 시작하기

1. Supabase 프로젝트를 생성합니다.
2. `.env.local.example`을 `.env.local`로 복사하고 프로젝트 URL/anon key를 입력합니다.

   ```bash
   cp .env.local.example .env.local
   ```

3. 의존성 설치 후 마이그레이션을 적용합니다 (Supabase CLI 필요).

   ```bash
   npm install
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) 접속 시 로그인 여부에 따라
   `/login` 또는 `/dashboard`로 이동합니다.

## 데이터 모델

- `profiles` — 인증 사용자 확장 정보 (role: admin/manager/staff)
- `categories` — 상품 카테고리
- `suppliers` — 공급업체
- `warehouses` — 창고/지점
- `products` — 상품 마스터 (SKU, 가격, 재주문 기준 수량 등)
- `inventory` — 창고별 상품 재고 수량 (product_id + warehouse_id 유니크)
- `inventory_transactions` — 입고/출고/조정 이력. INSERT 시 트리거가 `inventory` 수량을
  자동 반영합니다.

RLS는 로그인한 사용자에게 전체 테이블 조회/등록/수정 권한을 부여하는 MVP 수준으로
설정되어 있으며, `profiles`만 본인 행에 한해 접근 가능합니다. 조직 규모가 커지면
`role` 컬럼 기반으로 정책을 세분화하세요.

## 스크립트

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버
npm run lint    # ESLint
```

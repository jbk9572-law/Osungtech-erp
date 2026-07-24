# Netlify에 백업 배포로 올려서 테스트하기

지금 오라클 클라우드 서버(Docker + Caddy)로 운영 중인 걸 끄지 않고,
Netlify에 같은 코드를 병렬로 배포해서 안정적으로 쓸 수 있는 수준인지
먼저 확인하는 절차다. 도메인은 테스트가 끝나고 확신이 선 뒤에만 옮긴다.

## 1. Netlify에 사이트 추가

1. https://app.netlify.com 로그인 → **Add new site > Import an existing project**
2. GitHub 연동 후 `jbk9572-law/Osungtech-erp` 저장소 선택
3. 배포할 브랜치는 `main`으로 지정 (지금 운영 중인 오라클 서버와 같은 코드)
4. Build settings는 저장소에 있는 `netlify.toml`을 그대로 인식한다 —
   빌드 명령(`npm run build`)이 자동으로 채워지면 그대로 두면 된다

## 2. 환경변수 등록 (필수)

Site configuration > **Environment variables**에서 아래 두 개를 등록한다
(오라클 서버의 `.env.production`과 같은 값):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

값은 Supabase 대시보드 > Project Settings > API에서 그대로 복사하면 된다.
이 값들은 빌드 시점에 번들에 박히는 공개 값이라 등록 안 하면 빌드는
되지만 로그인/DB 조회가 전부 실패한다.

## 3. 첫 배포 확인

배포가 끝나면 Netlify가 자동으로 만들어주는 임시 주소
(`https://<사이트이름>.netlify.app`)로 접속해서 확인한다:

- 로그인이 되는지
- 대시보드/매입/매출/할일 목록이 실제 데이터로 뜨는지
- 매입·매출 등록, 재고 반영이 정상 동작하는지 (될 수 있으면 테스트성
  거래처/품목으로 시험 등록해보고 지워도 되는 것으로 확인)
- 모조지 계산, 인쇄(명세표/출고증) 화면도 열어본다

이 단계에서는 아직 도메인을 연결하지 않으므로, `.netlify.app` 임시
주소로만 확인하면 된다 — 오라클 서버 쪽 실제 서비스는 전혀 영향받지
않는다.

## 4. 도메인은 나중에

지금 쓰는 도메인은 오라클 서버(Caddy)를 그대로 가리키고 있다. Netlify
쪽이 며칠 이상 안정적으로 확인되고 나서, 이 도메인의 DNS를 Netlify로
옮기면 그때부터 실제 서비스가 Netlify로 넘어간다(오라클 유료 전환 시점에
맞춰 진행 예정). 그 전까지는 오라클 서버를 끄지 않는다.

## 참고: 코드에서 미리 손봐둔 부분

- `next.config.ts`의 `output: "standalone"`은 오라클 Docker 배포 전용
  설정이라 Netlify 빌드에서는 자동으로 꺼지도록 해뒀다(Netlify가 빌드 중
  자동으로 심어주는 `NETLIFY` 환경변수로 판별). 오라클 쪽 빌드에는
  영향 없다.
- 사이드바의 "서버 디스크" 사용량 위젯은 실제 서버 파일시스템을 읽는
  코드라, Netlify(서버리스 환경)에서는 값을 못 읽어서 자동으로 숨겨진다
  (에러 아님, 정상 동작).
- 파일 업로드(브랜딩 이미지, 메신저 첨부파일)는 이미 Supabase Storage를
  쓰고 있어서 플랫폼이 바뀌어도 그대로 동작한다.

# AWS Lightsail(서울 리전)로 셀프호스팅하기

Cloudflare Workers의 콜드스타트 문제(연결 재사용 안 됨, 20초 지연)를
구조적으로 없애기 위해, 상시 가동 서버로 다시 옮기는 절차다.
`docs/self-hosting-oracle.md`(Vultr/오라클에서 실제로 운영했던 방식)와
거의 동일한 구조이고, 차이는 서버를 AWS Lightsail 서울 리전에 두고
DuckDNS 대신 이미 갖고 있는 실제 도메인(`app.elvonix.co.kr`)을
Cloudflare 프록시 뒤에서 그대로 쓴다는 점뿐이다.

## 전체 구조

- **AWS Lightsail 서울 리전(ap-northeast-2)**: Next.js 앱을 Docker로
  실행(기존 Vultr/오라클 때와 동일한 `Dockerfile`/`docker-compose.yml`)
- **Caddy**: 앞단에서 HTTPS를 자동으로 처리해서 앱으로 넘겨준다(기존과
  동일) — Cloudflare 프록시 뒤에서도 Let's Encrypt 자동 발급이 그대로
  된다(Cloudflare가 80/443 요청을 그대로 오리진에 전달하기 때문)
- **Cloudflare**: Workers는 더 이상 안 쓰고, DNS + 프록시(CDN/DDoS
  방어)로만 남는다. R2(첨부파일 저장소)도 그대로 유지
- **Supabase**: DB/인증/파일저장 전부 그대로, 바뀌는 것 없음 — 데이터
  이관 작업 자체가 없다

## 1. Lightsail 인스턴스 만들기 (사용자가 AWS 콘솔에서 직접)

1. AWS 콘솔 > Lightsail > **Create instance**
2. 리전: **아시아 태평양(서울)** (`ap-northeast-2`)
3. 플랫폼: Linux/Unix, 블루프린트: **OS Only > Ubuntu 22.04 LTS**
4. 플랜: 2GB RAM 플랜 이상 권장
5. SSH 키 페어는 Lightsail이 기본 제공하는 걸 그대로 쓰거나 직접 업로드
6. 생성 후 **고정 IP(Static IP)** 발급해서 이 인스턴스에 연결(필수 —
   안 하면 재시작할 때마다 IP가 바뀌어서 국세청 API 연동도 끊긴다)
7. **Networking** 탭에서 방화벽 규칙에 HTTP(80), HTTPS(443), SSH(22) 허용
   확인(기본값에 보통 포함돼 있음)

## 2. 서버 접속 및 Docker 설치

Lightsail 콘솔의 **Connect using SSH** 버튼으로 브라우저에서 바로
접속하거나, 터미널에서:

```bash
ssh -i <다운받은키.pem> ubuntu@<Lightsail 고정 IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 재접속해야 docker 명령이 sudo 없이 됨
exit
```

## 3. 저장소 내려받고 설정

다시 서버에 접속한 뒤:

```bash
git clone https://github.com/jbk9572-law/Osungtech-erp.git
cd Osungtech-erp
cp .env.production.example .env.production
nano .env.production
```

`.env.production`에 채울 값(전부 지금 Cloudflare Workers에서 쓰던 값과
동일 — Supabase 대시보드 > Project Settings > API에서 그대로 복사):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_DOMAIN=app.elvonix.co.kr` (이미 쓰던 실제 도메인 — DuckDNS 아님)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (푸시 알림, 이미 쓰던 값)
- `CRON_SECRET` (mail-sync/messenger-alerts GitHub Actions가 이미 쓰는 값과 동일하게)
- `PORTAL_HOSTNAME=portal.elvonix.co.kr` (쓰고 있었다면)
- `SENTRY_DSN` (Sentry 프로젝트 Client Keys — `.env` 파일로 직접 읽으니
  Cloudflare Workers 대시보드 시크릿 전달 문제가 여기선 아예 없다)

## 4. 실행

```bash
export $(cat .env.production | xargs)
docker compose up -d --build
```

이 시점에는 아직 도메인이 이 서버를 안 가리키고 있어서 바로 접속은
안 된다 — 다음 단계(Cloudflare DNS)까지 끝내야 한다.

## 5. Cloudflare DNS를 이 서버로 돌리기

1. Cloudflare 대시보드 > `elvonix.co.kr` 존 > DNS
2. `app` 레코드(A 레코드)의 값을 Lightsail 고정 IP로 수정
3. 프록시 상태는 **켜둔 채로**(오렌지 클라우드) 유지 — Cloudflare의
   무료 CDN/DDoS 방어를 그대로 쓴다
4. SSL/TLS 탭에서 암호화 모드를 **Full (strict)**로 설정(Caddy가 발급한
   정식 인증서를 쓰므로 strict로도 문제없음)

DNS가 전파되면(보통 몇 분) `https://app.elvonix.co.kr`으로 접속된다 —
Caddy가 첫 접속 시 자동으로 Let's Encrypt 인증서를 발급받는다.

## 6. 기존 Cloudflare Workers 쪽 정리 (확인 끝난 뒤)

새 서버가 며칠 이상 안정적으로 확인된 뒤에만:

- Cloudflare 대시보드의 `elvonix-erp` Workers 프로젝트는 더 이상 안
  쓰므로 삭제하거나 그대로 방치(과금 없음, Workers Paid 요금제 자체를
  해지할지는 별도 판단)
- `.github/workflows/supabase-warmup.yml`과 cron-job.org의 1분 핑 job
  삭제 — 상시 가동 서버에서는 콜드스타트 자체가 없어서 더 이상 필요
  없다
- `wrangler.jsonc`, `worker.ts`, `open-next.config.ts`, `@opennextjs/cloudflare`
  관련 의존성은 코드베이스에서 제거(별도 작업으로 진행)

## 7. 업데이트하는 방법 (오라클 때와 동일)

```bash
cd Osungtech-erp
git pull
export $(cat .env.production | xargs)
docker compose up -d --build
```

## 참고: 이 방식의 한계

- 서버가 죽거나 AWS 쪽 장애가 나면 자동 복구가 안 된다 — 재시작을
  직접 해야 할 수 있다. 필요하면 나중에 간단한 헬스체크+자동재시작
  스크립트나 CloudWatch 알람을 추가로 고려할 수 있다.
- 백업은 Supabase가 관리하므로(DB) 서버 자체가 날아가도 데이터 손실은
  없다 — 서버만 새로 만들어서 이 문서대로 다시 올리면 된다.
- 지금 규모(내부 직원 소수)에서는 2GB Lightsail 플랜으로 충분하다.
  테넌트가 크게 늘어나면 인스턴스 사양을 올리거나(다운타임 짧게
  재부팅 필요) 추후 로드밸런서+복수 인스턴스 구조를 고려한다.

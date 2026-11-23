# 매일실천

예방 습관을 기록하는 홈 화면 설치형 웹앱이에요. 첫 화면, 체크리스트, 설정의 기존 구성을 유지해요.

## 실행과 점검
Node.js 24에서 `npm install` 후 `npm run dev`로 화면과 로컬 알림 API를 함께 실행해요.
`npm run test:notifications`는 암호화·서명·일정 계산을 점검해요.
실행 중인 미리보기에서 `node scripts/test-notifications.mjs --preview`로 저장·삭제·기기 분리와 동시 실행을 점검할 수 있어요. 실제 푸시는 보내지 않아요.
`npx tsc -p tsconfig.notifications.json`으로 알림 코드의 타입을 검사해요.

## 기록과 알림
- 체크 기록은 기존 `daily-practice-v1` 브라우저 저장소에만 남아요. 다른 주소나 기기로 옮길 때는 설정에서 백업을 내려받아 가져와 주세요.
- 알림을 켜면 구독 정보와 활성 일정의 이름·시간·시작일만 보관해요. 체크 기록은 전송하지 않아요.
- 기기별 무작위 토큰으로 자기 연결만 변경할 수 있어요. 공개 열람·목록 API는 없어요.
- 알림 끄기는 해당 기기의 구독과 예약 사본을 삭제하며 체크 기록은 유지해요.
- 한국 시간 매일 07:00 안내와 반복 일정 30분 전 안내를 요청해요. 자정 직후 일정도 전날 안내 대상으로 계산해요.
- 발송 전에 예약 시각을 조건부 갱신해 동시·중복 실행을 억제해요. 중복 방지가 우선이므로 실패한 개별 발송은 자동 재시도하지 않아요. 30분 넘게 지난 알림은 건너뛰어요.
- 테스트 성공은 제공처가 발송 요청을 접수했다는 뜻이에요. 휴대폰 표시·읽음 확인이 아니에요.

## 게시와 GitHub 자동 실행
현재 방식은 Firebase 없이 Worker + D1과 `.github/workflows/notifications.yml`을 사용해요.
BAZE 게시에는 `baze.json`에 선언한 `NOTIFICATION_SECRET`이 필요해요. 이 값에서 용도가 분리된 VAPID 키와 실행 토큰을 유도해요. 임의 변경 시 기존 구독을 다시 연결해야 해요.
미리보기도 등록된 키를 자식 프로세스의 환경으로만 전달해 사용해요. 실제 비밀값은 파일에 쓰지 않아요. 키를 등록하기 전에는 프로젝트 밖의 별도 시험 키를 사용해요. 키·개인 백업은 소스와 다운로드 파일에 넣지 않아요.

GitHub 저장소에는 다음 설정을 연결해야 해요.
- Secret `NOTIFICATION_CRON_TOKEN`: 마스터 키에 HMAC-SHA256, 메시지 `maeil-cron-v1`을 적용한 16진수 값
- Variable `NOTIFICATION_APP_URL`: `https://maeil-silcheon.baze.cloud`
- Variable `NOTIFICATIONS_ENABLED`: `true` (게시 후 켜요)

예약 workflow는 기본 브랜치에 있어야 실행돼요. 5분 간격을 요청하지만 GitHub 실행은 지연·누락될 수 있고 공개 저장소에 60일간 활동이 없으면 중지될 수 있어요. 정시 알람을 보장하지 않으며 중요한 약 복용 등의 알람을 대신하지 않아요.
공식 안내: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## 휴대폰 확인
수정본 게시 후 공개 주소에서 설정 → 알림 켜기 → 테스트 알림 보내기를 사용해요.
아이폰·아이패드는 Safari에서 홈 화면에 추가한 앱을 열어 알림을 허용해 주세요. 안드로이드는 지원 브라우저에서 권한을 허용해 주세요.
앱을 닫은 상태에서 테스트 및 예약 수신을 실제로 확인하기 전에는 수신 검증 완료가 아니에요.
인터넷·집중 모드·OS 절전·권한·구독 만료에 따라 늦거나 누락될 수 있어요.
브라우저 데이터를 지우면 기존 구독을 끌 토큰도 사라져 잔여 정보가 남을 수 있어요. 체크 기록은 먼저 백업해 주세요.

## 다운로드와 원본
`node scripts/package-download.mjs`는 `public/index.html`을 동기화하고 현재 알림 방식의 소스 ZIP을 만들어요.
`functions/`, `firebase.json`, `firestore.rules`, `배포안내.md` 등은 첨부 원본의 Firebase 방식 참고용이에요. 현재 앱은 이 경로를 호출하지 않으며 그 안내만 따라 게시하면 현재 알림 API는 동작하지 않아요.
GitHub 코드 공개, BAZE의 앱 게시, 자동 실행 활성화는 각각 별도 작업이에요. 실제 휴대폰 설치와 수신은 아직 확인이 필요해요.

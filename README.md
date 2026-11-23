# 매일실천

예방 습관의 실천 여부를 기록하는 홈 화면 설치형 웹앱이에요.

## 현재 화면
- 첫 화면: 이번 주 기록과 오늘의 완료율
- 체크리스트: 실천 추가·삭제와 날짜별 완료 체크
- 설정: 백업 내려받기·가져오기, 홈 화면 설치, 예약 알림 안내

## 실행
Node.js 22.12 이상에서 `npm install` 후 `npm run dev`로 실행해요.
정적 배포 파일은 `npm run build`로 만들어요.
Firebase Hosting은 `public` 폴더를 사용해요. 루트 문서를 수정하면 `public/index.html`도 맞춰 주세요.

## 현재 제한
체크 기록은 사용하는 브라우저에만 저장돼요. 다른 기기로 옮길 때는 백업을 사용해 주세요.
Firebase 프로젝트 정보와 발송용 키는 연결되지 않았어요. 예약 알림은 현재 비활성 상태예요.
이 저장소 공개만으로 GitHub Pages 게시나 알림 발송이 설정되지는 않아요.
실제 휴대폰 설치와 푸시 수신은 별도 확인이 필요해요.
비밀키, 개인 백업과 첨부 원본은 이 저장소에 포함하지 않아요.

## 원본 Firebase 배포 안내
실제 배포 전 패키지입니다. Firebase 프로젝트와 결제 연결은 사용자가 진행해야 합니다. 실제 푸시 수신 시험은 미실시했습니다.

## 구성
Hosting + Functions(서울) + Firestore + Cloud Scheduler. FCM SDK 대신 표준 Web Push(VAPID)를 사용하므로 Android·홈 화면 iOS 웹앱에 동일한 구조로 보냅니다. 기존 화면과 앱 아이콘을 유지했습니다. Google 로그인은 포함하지 않으며 기기별 익명 인증으로 구독을 분리합니다.

## 사전 준비
Node.js 22와 Firebase CLI가 설치된 개인 컴퓨터에서 진행하세요.
1. Firebase Console에서 프로젝트 생성 → Blaze 요금제 연결. Functions, Scheduler, Firestore 사용료가 발생할 수 있습니다. 예산 알림은 지출 한도가 아닙니다.
2. Firestore Database를 프로덕션 모드로 생성(가능하면 서울). Authentication → Sign-in method → 익명 활성화.
3. 프로젝트 설정에서 웹앱 등록. SDK 설정 객체를 public/firebase-config.js에 입력. .firebaserc의 프로젝트ID도 변경.
4. Authentication → Settings → Authorized domains에서 실제 Hosting 도메인(프로젝트ID.web.app)을 확인하고 필요하면 추가.

## 명령어
패키지 루트에서:
```sh
npm install -g firebase-tools
firebase login
cd functions
npm install
node create-vapid.js
cd ..
firebase functions:secrets:set VAPID_PUBLIC_KEY
firebase functions:secrets:set VAPID_PRIVATE_KEY
firebase functions:secrets:set VAPID_SUBJECT
firebase deploy --only hosting,functions,firestore:rules
```
키 생성 출력의 publicKey/privateKey를 각 질문에 붙여넣으세요. SUBJECT는 본인 연락용 mailto:이메일주소. 비밀키는 GitHub나 채팅에 올리지 마세요. 한번 생성한 키를 유지하세요. 변경하면 기기 구독을 다시 만들어야 합니다. Firebase CLI의 API 활성화 요청을 승인하세요.

## 사용 및 점검
배포된 HTTPS 주소에서 알림 켜기 → 테스트. Android Chrome 사용. iPhone은 iOS 16.4 이상 Safari에서 공유 → 홈 화면에 추가 후 설치 앱에서 알림 허용.
한국 시간 07:00 알림 및 설정된 시간의 30분 전 알림. 자정 직후 일정은 전날 미리 전송합니다. 테스트 일정은 현재 한국 시간보다 32분 뒤로 지정하고 서버 동기화 성공을 확인한 뒤 앱을 닫아 수신 시험하세요. 일정을 수정하면 온라인에서 서버 저장에 성공해야 반영됩니다. 기존 Render 배포를 사용 중이었다면 기존 예약 작업/구독을 해제해 중복 알림을 방지하세요.

## 제한과 운영
- 단일 HTML만 배포하는 방식이 아닙니다. ZIP 전체 구성을 배포해야 합니다.
- 기기 로컬 체크 기록은 유지되지만 기기 간 동기화는 없습니다. 구독·일정 이름과 시간만 서버 저장. 개인정보 입력 금지. 끄기 시 해당 기기 서버 문서 삭제.
- 인터넷·알림 권한·OS 정책에 따라 지연/누락 가능. 강제 중지에서는 보장 불가. 스케줄러가 해당 분에 실행되지 않으면 지난 알림을 재전송하지 않습니다. 중복 억제를 우선해 전송 실패 이벤트도 자동 재시도하지 않습니다.
- 사용자 1명당 기기별 익명 계정 사용. 브라우저 데이터 삭제 후에는 이전 기기 문서가 남을 수 있으므로 관리자 콘솔에서 정리해야 합니다.
- 개인/과제 및 소규모 시험용. 공개 서비스 전 App Check 강제, 구독 API 호출 제한, Firestore 비용 모니터링, 개인정보 고지, 오류 감시와 전송 큐 보강을 권장합니다. 익명 인증만으로 남용을 완전히 막을 수 없습니다.
- 서버 접근은 인증된 Callable Functions만 가능하며 브라우저의 Firestore 직접 접근은 차단합니다. 허용 푸시 엔드포인트는 Google·Apple·Mozilla입니다.
- 기본 목록/상태 저장 키를 유지합니다. 원래 웹 주소와 다른 주소에 배포하면 브라우저 저장 기록이 자동 이동하지 않으므로 이전 앱에서 백업 후 가져오세요.


## 홈 화면 설치형 PWA
이 패키지는 APK가 아닙니다. 기존 안내대로 프로젝트 설정·비밀키·익명 인증·Firestore를 준비하고 전체를 배포하세요. 배포 후 출력되는 HTTPS Hosting 주소를 공유하세요. Android Chrome의 설치 버튼/메뉴, iPhone Safari 공유 → 홈 화면에 추가로 설치합니다. 설치 후 알림 켜기·테스트를 진행하세요. 기본 화면 오프라인 캐시가 포함되지만 외부 SDK와 서버 통신에는 인터넷이 필요합니다. 실제 배포·기기 설치·수신 시험은 미실시했습니다. 앱 변경 시 서비스 워커 캐시 버전을 올리세요.

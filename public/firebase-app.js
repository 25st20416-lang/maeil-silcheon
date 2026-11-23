import {firebaseConfig} from './firebase-config.js';
const panel=document.createElement('section');
panel.className='card';
panel.innerHTML='<h2>휴대폰 예약 알림</h2><p>매일 오전 7시 · 일정 30분 전 (한국 시간)</p><button id="firebaseOn" class="primary wide">알림 켜기</button><button id="firebaseOff" class="secondary wide">알림 끄기</button><button id="firebaseTest" class="secondary wide">테스트 알림 보내기</button><p id="firebaseStatus" role="status"></p>';
document.getElementById('backupScreen').insertBefore(panel,document.querySelector('#backupScreen > .history-help'));
const status=t=>document.getElementById('firebaseStatus').textContent=t;
const configured=firebaseConfig.projectId&&!firebaseConfig.projectId.includes('프로젝트')&&!firebaseConfig.apiKey.includes('여기에');
if(!configured){
  panel.querySelectorAll('button').forEach(b=>b.disabled=true);
  status('예약 알림은 아직 연결되지 않았어요. 배포 담당자가 Firebase 설정을 연결하면 사용할 수 있어요. 실천 기록과 백업은 지금 사용할 수 있어요.');
}else{
  try{
    const [{initializeApp},{getAuth,signInAnonymously},{getFunctions,httpsCallable}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js')
    ]);
    const app=initializeApp(firebaseConfig),auth=getAuth(app),fn=getFunctions(app,'asia-northeast3');
    async function call(name,data={}){await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);return(await httpsCallable(fn,name)(data)).data}
    let enabled=localStorage.getItem('firebase-push-enabled')==='1',queue=Promise.resolve();
    async function sync(){if(!enabled)return;try{await call('saveTasks',{tasks:state.tasks.filter(t=>!t.deleted)});status('알림 일정이 저장됐어요. 체크 기록은 이 기기에만 남아요.')}catch{status('알림 일정을 저장하지 못했어요. 인터넷과 연결 설정을 확인해 주세요.')}}
    const oldSave=save;save=function(){oldSave();queue=queue.then(sync)};
    status('알림을 켜면 일정 이름·시간과 기기 구독 정보를 전송해요. 아이폰은 홈 화면에 설치한 앱에서 허용해 주세요.');
    document.getElementById('firebaseOn').onclick=async()=>{try{
      if(!isSecureContext||!('PushManager'in window)||!('Notification'in window))throw Error('이 브라우저에서는 알림을 사용할 수 없어요. 설치한 앱에서 다시 시도해 주세요.');
      if(await Notification.requestPermission()!=='granted')throw Error('브라우저 설정에서 알림을 허용해 주세요.');
      await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;
      const{key}=await call('publicKey');const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(key.length/4)*4,'='));
      const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
      await call('subscribe',{subscription:sub.toJSON()});enabled=true;localStorage.setItem('firebase-push-enabled','1');await sync();
    }catch(e){status(e.message?.startsWith('이 브라우저')||e.message?.startsWith('브라우저 설정')?e.message:'알림을 연결하지 못했어요. 인터넷과 Firebase 설정을 확인해 주세요.')}};
    document.getElementById('firebaseOff').onclick=async()=>{try{await call('disable');enabled=false;localStorage.removeItem('firebase-push-enabled');const reg=await navigator.serviceWorker.getRegistration();const sub=reg&&await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();status('알림을 끄고 저장된 구독과 일정을 삭제했어요.')}catch{status('알림을 끄지 못했어요. 인터넷을 확인하고 다시 시도해 주세요.')}};
    document.getElementById('firebaseTest').onclick=async()=>{try{await call('testPush');status('테스트 알림을 요청했어요. 휴대폰에서 수신을 확인해 주세요.')}catch{status('테스트 알림을 보내지 못했어요. 알림을 먼저 켜고, 1분 뒤 다시 시도해 주세요.')}};
    window.addEventListener('online',sync);if(enabled)sync();
  }catch{status('알림 연결을 불러오지 못했어요. 인터넷을 확인하고 다시 열어 주세요. 기록은 계속 사용할 수 있어요.')}
}

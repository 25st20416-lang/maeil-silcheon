const notificationPanel=document.createElement('section');notificationPanel.className='card notification-card';
notificationPanel.innerHTML=`<h2>휴대폰 예약 알림</h2>
<p>매일 오전 7시 · 일정 30분 전 안내 (한국 시간)</p>
<p id="notificationBadge" class="notification-badge" role="status">연결 상태 확인 중…</p>
<button id="firebaseOn" class="primary wide" type="button" disabled>알림 켜기</button>
<button id="firebaseOff" class="secondary wide" type="button" disabled>알림 끄기</button>
<button id="firebaseTest" class="secondary wide" type="button" disabled>테스트 알림 보내기</button>
<p id="firebaseStatus" role="status">알림 연결을 확인하고 있어요.</p>
<p id="notificationSaved" class="note" role="status"></p><p id="schedulerStatus" class="note" role="status"></p>
<button id="notificationRefresh" class="secondary wide" type="button">연결 상태 새로고침</button>
<details class="notification-help"><summary>알림 사용 전 확인해 주세요</summary><p>알림을 켜면 이 기기의 수신 정보와 일정 이름·시간만 발송을 위해 보관해요. 체크 기록은 보내지 않아요. 알림을 끄면 해당 기기의 연결과 일정 사본을 삭제해요.</p><p>GitHub 자동 실행은 5분 간격으로 확인하도록 구성돼요. 실행 지연·누락이나 휴대폰 상태에 따라 늦거나 오지 않을 수 있어요. 공개 저장소에 60일간 활동이 없으면 자동 실행이 중지될 수 있어요. 중요한 약 복용 등 정확한 시간의 알람을 대신할 수는 없어요.</p><p>아이폰·아이패드는 Safari에서 홈 화면에 추가한 앱에서 알림을 켜 주세요. 안드로이드는 알림 권한을 허용해 주세요.</p></details>`;
document.getElementById('backupScreen').insertBefore(notificationPanel,document.querySelector('#backupScreen > .history-help'));
const nEl=id=>document.getElementById(id),TOKEN_KEY='maeil-push-token-v1',ENABLED_KEY='maeil-push-enabled-v1';
let nConfig=null,nEnabled=false,nBusy=false,nTimer,nLastTasks='',nLastCheck=0,nSyncing=false;
const notifyStatus=text=>{nEl('firebaseStatus').textContent=text};
function nButtons(){nEl('firebaseOn').disabled=nBusy||!nConfig?.ready;nEl('firebaseOff').disabled=nBusy||!nEnabled;nEl('firebaseTest').disabled=nBusy||!nEnabled;nEl('notificationRefresh').disabled=nBusy;notificationPanel.setAttribute('aria-busy',String(nBusy));}
function nSetEnabled(value){nEnabled=value;localStorage.setItem(ENABLED_KEY,value?'1':'0');nEl('notificationBadge').textContent=value?'이 기기 알림 연결됨':'이 기기 알림 꺼짐';nEl('firebaseOn').textContent=value?'알림 다시 연결하기':'알림 켜기';nButtons();}
function nToken(create=false){let token=localStorage.getItem(TOKEN_KEY);if(!/^[a-f0-9]{64}$/.test(token||'')){if(!create)return '';token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem(TOKEN_KEY,token)}return token}
function nTasks(){return state.tasks.filter(t=>!t.deleted).map(t=>({id:t.id,name:t.name,time:t.time||'',created:t.created}));}
async function nApi(path,method='GET',data){
 const response=await fetch('/api/notifications/'+path,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+nToken()},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});
 const result=await response.json().catch(()=>({error:'알림 연결을 확인하지 못했어요.'}));
 if(!response.ok)throw Error(result.error||'알림 연결을 다시 확인해 주세요.');return result;
}
function nTime(value){return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value))}
function nShowSaved(value){nEl('notificationSaved').textContent='일정 저장 완료: '+nTime(value);}
async function nLoad(){
 nBusy=true;nButtons();nLastCheck=Date.now();
 try{
  const response=await fetch('/api/notifications/config',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('공개된 앱의 알림 연결이 아직 준비되지 않았어요.');
  nConfig=await response.json();
  if(!nConfig.ready){nEl('notificationBadge').textContent='알림 연결 준비 중';notifyStatus('알림 발송을 위한 설정이 아직 완료되지 않았어요. 완료되면 이 화면에서 알림을 켤 수 있어요.');return}
  nEnabled=localStorage.getItem(ENABLED_KEY)==='1'&&!!nToken();
  if(nEnabled){const result=await nApi('status');nEnabled=result.connected;if(result.device?.delivery_status==='expired')nEnabled=false;if(result.device?.updated_at)nShowSaved(result.device.updated_at)}
  nSetEnabled(nEnabled);nLastTasks='';
  const tick=nConfig.lastTickAt;
  nEl('schedulerStatus').textContent=nConfig.preview?'미리보기에서는 연결과 저장을 점검해요. 휴대폰 설치·수신은 공개 주소에서 확인해 주세요.':!tick?'자동 발송이 아직 실행된 기록이 없어요. 연결 설정이 끝난 뒤 다시 확인해 주세요.':Date.now()-tick>1200000?'자동 발송 확인이 늦어지고 있어요. 마지막 확인: '+nTime(tick):'자동 발송 최근 확인: '+nTime(tick);
  notifyStatus(nEnabled?'알림이 연결돼 있어요. 테스트를 보내 실제 휴대폰 수신을 확인해 주세요.':'알림 켜기를 누르고 기기의 알림 권한을 허용해 주세요.');
 }catch(e){nConfig=null;nEl('notificationBadge').textContent='연결 확인 필요';notifyStatus(e.name==='TimeoutError'?'연결 시간이 오래 걸려요. 인터넷을 확인하고 다시 시도해 주세요.':e.message||'인터넷을 확인하고 다시 시도해 주세요.')}
 finally{nBusy=false;nButtons();if(nConfig?.ready&&nEnabled)void nSync()}
}
async function nSync(){
 if(!nEnabled||nSyncing)return;const tasks=nTasks(),snapshot=JSON.stringify(tasks);if(snapshot===nLastTasks)return;nSyncing=true;let success=false;
 try{const result=await nApi('tasks','PUT',{tasks});nLastTasks=snapshot;success=true;if(nEnabled){nShowSaved(result.savedAt);notifyStatus('변경한 알림 일정을 저장했어요. 체크 기록은 이 기기에만 남아요.')}}
 catch(e){if(nEnabled)notifyStatus(e.message+' 일정 변경이 반영되지 않았어요. 인터넷 연결 후 다시 확인해 주세요.')}
 finally{nSyncing=false;if(success&&nEnabled&&JSON.stringify(nTasks())!==snapshot)nTimer=setTimeout(()=>void nSync(),100)}
}
const oldNotificationSave=save;save=function(){oldNotificationSave();clearTimeout(nTimer);nTimer=setTimeout(()=>{if(!nBusy)void nSync()},900)};
nEl('firebaseOn').onclick=async()=>{
 if(nBusy)return;nBusy=true;nButtons();
 try{
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isiOS&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)throw Error('Safari에서 홈 화면에 추가한 매일실천 앱을 열고 알림을 켜 주세요.');
  if(!isSecureContext||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('이 브라우저에서는 알림을 지원하지 않아요. 설치한 앱이나 지원하는 브라우저에서 다시 열어 주세요.');
  if(window.top!==window.self)throw Error('미리보기 안에서는 알림을 허용할 수 없어요. 공개된 앱 주소를 휴대폰에서 직접 열어 주세요.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('알림 권한이 허용되지 않았어요. 브라우저와 기기 설정에서 이 앱의 알림을 허용해 주세요.');
  await navigator.serviceWorker.register('/sw.js');
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const previousToken=nToken();nToken(true);
  const publicKey=Uint8Array.from(atob(nConfig.publicKey.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(nConfig.publicKey.length/4)*4,'=')),v=>v.charCodeAt(0));
  const oldKey=sub?.options.applicationServerKey;
  if(sub&&(!previousToken||!oldKey||String(new Uint8Array(oldKey))!==String(publicKey))){await sub.unsubscribe();sub=null}
  sub=sub||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
  const tasks=nTasks();const result=await nApi('subscribe','POST',{subscription:sub.toJSON(),tasks});
  nSetEnabled(true);nLastTasks=JSON.stringify(tasks);nShowSaved(result.savedAt);
  notifyStatus('알림과 일정을 연결했어요. 테스트 알림을 보내 휴대폰 수신을 확인해 주세요.');
 }catch(e){notifyStatus(e.message||'알림 연결에 실패했어요. 다시 시도해 주세요.')}
 finally{nBusy=false;nButtons();void nSync()}
};
nEl('firebaseOff').onclick=async()=>{
 if(nBusy)return;nBusy=true;nButtons();
 try{await nApi('subscription','DELETE');nSetEnabled(false);nEl('notificationSaved').textContent='';notifyStatus('알림을 끄고 이 기기의 알림 연결과 일정 사본을 삭제했어요. 체크 기록은 유지돼요.');try{const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub)await sub.unsubscribe()}catch{}}
 catch(e){notifyStatus(e.message+' 알림 연결 삭제가 완료되지 않았어요.')}
 finally{nBusy=false;nButtons()}
};
nEl('firebaseTest').onclick=async()=>{
 if(nBusy)return;nBusy=true;nButtons();notifyStatus('테스트 알림 발송을 요청하고 있어요…');
 try{const result=await nApi('test','POST',{});notifyStatus(result.message+' 수신되지 않으면 기기의 알림·집중 모드 설정을 확인해 주세요.')}
 catch(e){notifyStatus(e.message)}finally{nBusy=false;nButtons()}
};
nEl('notificationRefresh').onclick=()=>{void nLoad()};
window.addEventListener('online',()=>{if(nEnabled)void nSync()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!nBusy&&Date.now()-nLastCheck>60000)void nLoad()});
void nLoad();

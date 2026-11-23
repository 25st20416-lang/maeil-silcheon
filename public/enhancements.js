const backupScreen=document.createElement('main');
backupScreen.id='backupScreen';backupScreen.hidden=true;
backupScreen.setAttribute('aria-labelledby','backupTitle');
backupScreen.innerHTML='<header class="backup-intro"><h1 id="backupTitle">설정</h1><p>실천 기록 보관부터 앱 설치와 예약 알림까지,<br>필요한 설정을 한곳에서 관리해요.</p></header>';
document.getElementById('homeScreen').after(backupScreen);
const downloadCard=document.createElement('section');downloadCard.className='card';
downloadCard.innerHTML='<h2>기록 백업 내려받기</h2><p class="note">지금까지의 실천 목록과 체크 기록을 파일로 보관해요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 내려받아 주세요.</p>';
downloadCard.append(document.querySelector('.overview-actions'));
backupScreen.append(downloadCard);
const backupHelp=document.createElement('section');backupHelp.className='card';
backupHelp.innerHTML='<h2>기록 보관하기</h2><p class="note">체크 기록은 이 브라우저에 저장돼요. 다른 주소나 기기로 옮길 때 백업 파일을 가져와 주세요.</p><button id="restoreButton" class="secondary wide" type="button">백업 파일 가져오기</button><input id="restoreFile" type="file" aria-label="복원할 백업 파일" accept=".json,application/json" hidden><p id="restoreStatus" class="note" role="status"></p>';
backupScreen.append(backupHelp);
backupScreen.append(document.querySelector('.history-help'));
const backupNav=document.createElement('button');backupNav.id='navBackup';backupNav.type='button';
backupNav.textContent='설정';backupNav.setAttribute('aria-controls','backupScreen');
document.querySelector('.nav-tabs').append(backupNav);
document.getElementById('navHome').textContent='체크리스트';
document.getElementById('navOverview').textContent='첫 화면';
document.getElementById('navOverview').setAttribute('aria-controls','overview');
document.getElementById('navHome').setAttribute('aria-controls','homeScreen');
const baseShowScreen=showScreen;
showScreen=function(screen,updateAddress=true){
 if(screen==='settings')screen='backup';
 const target=['overview','home','backup'].includes(screen)?screen:'overview';
 baseShowScreen(target==='backup'?'overview':target);
 backupScreen.hidden=target!=='backup';
 if(target==='backup'){
  document.getElementById('overview').hidden=true;
  document.getElementById('navOverview').classList.remove('active');
  document.getElementById('navOverview').setAttribute('aria-current','false');
 }
 backupNav.classList.toggle('active',target==='backup');
 backupNav.setAttribute('aria-current',target==='backup'?'page':'false');
 if(updateAddress){const hash=target==='overview'?'':'#'+(target==='backup'?'settings':target);if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash)}
};
backupNav.onclick=()=>showScreen('backup');
window.addEventListener('popstate',()=>showScreen(location.hash.slice(1),false));
window.addEventListener('hashchange',()=>showScreen(location.hash.slice(1),false));
showScreen(location.hash.slice(1),false);
document.getElementById('restoreButton').onclick=()=>document.getElementById('restoreFile').click();
document.getElementById('restoreFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;const feedback=document.getElementById('restoreStatus');
 try{
  if(file.size>2*1024*1024)throw Error();
  const data=JSON.parse(await file.text());
  if(!data||!Array.isArray(data.tasks)||data.tasks.length>100||!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw Error();
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v));
  const ids=new Set();
  const tasks=data.tasks.map(t=>{if(!t||typeof t.id!=='string'||!t.id||t.id.length>100||ids.has(t.id)||['__proto__','constructor','prototype'].includes(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>200||!validDate(t.created)||(t.deleted&&!validDate(t.deleted))||(t.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)))throw Error();ids.add(t.id);return{id:t.id,name:t.name,created:t.created,time:t.time||'',priority:!!t.priority,...(t.deleted?{deleted:t.deleted}:{})}});
  const records={};for(const[date,record]of Object.entries(data.records)){if(!validDate(date)||!record||typeof record!=='object'||Array.isArray(record))throw Error();records[date]={};for(const[id,value]of Object.entries(record)){if(ids.has(id))records[date][id]=!!value}}
  if(!confirm('현재 기록을 백업 파일의 기록으로 바꿀까요? 필요한 기록은 먼저 백업해 주세요.'))return;
  state={tasks,records};save();selected=today();render();feedback.textContent='백업 기록을 가져왔어요.';
 }catch{feedback.textContent='이 파일은 가져올 수 없어요. 매일실천에서 내려받은 2MB 이하 백업 파일을 선택해 주세요.'}finally{e.target.value=''}
};
document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='매일실천-기록-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('기록을 백업했어요. 다른 기기에서 가져올 수 있어요.')};
const originalAddTask=addTask;addTask=function(){if(state.tasks.filter(t=>!t.deleted).length>=100){toast('실천은 최대 100개까지 등록할 수 있어요.');return false}return originalAddTask()};document.getElementById('addTask').onclick=addTask;
const foot=document.querySelector('footer');foot.innerHTML='<strong>매일실천 · 예방 습관 기록</strong><br>예방 행동의 습관화를 돕는 학습용 앱이에요. 감염 예방 효과를 측정하거나 진단하지 않아요.<br>약 복용은 의사·약사의 안내에 따라 기록해 주세요. 알림은 연결 설정과 인터넷·기기 상태에 따라 지연되거나 누락될 수 있어요.';

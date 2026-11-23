let promptInstall;
const box=document.createElement('section');box.className='card';
box.innerHTML='<h2>휴대폰에 앱 설치</h2><p class="note">홈 화면에 매일실천 아이콘을 추가해요. QR 코드나 링크를 여는 것만으로 자동 설치되지는 않아요.</p><button id="installPwa" class="primary wide" type="button">홈 화면에 설치하기</button><p id="installHelp" role="status">아이폰·아이패드: Safari에서 공유 버튼 → 홈 화면에 추가 → 추가를 눌러 주세요.<br>안드로이드: Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가를 선택해 주세요.</p>';
document.getElementById('backupScreen').insertBefore(box,document.querySelector('#backupScreen > .history-help'));
const help=document.getElementById('installHelp'),installButton=document.getElementById('installPwa');
function showInstalled(){installButton.hidden=true;help.textContent='이미 홈 화면에 설치된 앱에서 사용하고 있어요.'}
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)showInstalled();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstall=e});
installButton.onclick=async()=>{
 if(promptInstall){
  try{await promptInstall.prompt();const result=await promptInstall.userChoice;if(result.outcome==='accepted')help.textContent='설치를 요청했어요. 홈 화면에 매일실천 아이콘이 생겼는지 확인해 주세요.';else help.textContent='설치를 취소했어요. 원할 때 다시 설치할 수 있어요.'}catch{help.textContent='브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해 주세요.'}finally{promptInstall=null}
 }else{help.textContent='아이폰·아이패드는 이 주소를 Safari로 열고 공유 버튼 → 홈 화면에 추가 → 추가를 눌러 주세요. 안드로이드는 Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가를 선택해 주세요.'}
};
window.addEventListener('appinstalled',showInstalled);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{help.textContent='설치 준비를 마치지 못했어요. 인터넷을 확인하고 게시된 주소에서 다시 열어 주세요.'});

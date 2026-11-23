import assert from 'node:assert/strict';
import { randomBytes, createECDH, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { vapidKeys, subscriptionFrom, deliver, cronToken, digest } from '../worker/push.ts';
import { nextDue, advanceDue, validateTasks } from '../worker/schedules.ts';

const require = createRequire(import.meta.url);
const ece = require('http_ece');
const secret = randomBytes(32).toString('hex');
const key = createECDH('prime256v1');key.generateKeys();
const auth = randomBytes(16);
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/maeil-synthetic-test', keys: { p256dh: key.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
assert.deepEqual(subscriptionFrom(subscription), subscription);
for (const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x']) {
  assert.throws(() => subscriptionFrom({...subscription,endpoint}));
}
assert.throws(() => subscriptionFrom({...subscription,keys:{...subscription.keys,p256dh:'B'+'a'.repeat(86)}}));
assert.deepEqual(vapidKeys(secret), vapidKeys(secret));
assert.notEqual(vapidKeys(secret).publicKey, vapidKeys(secret+'different').publicKey);
const message = { body: '예시 실천 알림', tag: 'unit-test' };
let encrypted = false;
const status = await deliver(subscription,message,secret,'https://maeil-silcheon.baze.cloud',async (endpoint,request) => {
  assert.equal(endpoint,subscription.endpoint);
  assert.equal(request.method,'POST');
  assert.equal(request.headers['Content-Encoding'],'aes128gcm');
  const decrypted = ece.decrypt(Buffer.from(request.body),{ version:'aes128gcm',privateKey:key,authSecret:auth });
  assert.deepEqual(JSON.parse(decrypted.toString()),message);
  const jwt = request.headers.Authorization.match(/t=([^,]+)/)[1];
  const [header,payload,signature]=jwt.split('.');
  const claim=JSON.parse(Buffer.from(payload,'base64url'));
  assert.equal(claim.aud,'https://fcm.googleapis.com');
  const publicKey=Buffer.from(vapidKeys(secret).publicKey,'base64url');
  const verifier=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:publicKey.subarray(1,33).toString('base64url'),y:publicKey.subarray(33).toString('base64url')}});
  assert(verify('sha256',Buffer.from(header+'.'+payload),{key:verifier,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
  encrypted=true;
  return new Response('',{status:201});
});
assert.equal(status,201);assert(encrypted);
assert.equal(new Date(nextDue('07:00','2026-11-23',0,Date.parse('2026-11-22T21:59:00Z'))).toISOString(),'2026-11-22T22:00:00.000Z');
assert.equal(new Date(nextDue('00:15','2026-11-24',1800000,Date.parse('2026-11-23T14:00:00Z'))).toISOString(),'2026-11-23T14:45:00.000Z');
assert.equal(new Date(nextDue('07:00','2026-11-23',0,Date.parse('2026-11-22T22:00:00Z'))).toISOString(),'2026-11-23T22:00:00.000Z');
assert(advanceDue(0,86400001)>86400001);
for(const tasks of [[{id:'__morning__',name:'x',time:'07:00',created:'2026-11-23'}],[{id:'a',name:'x',time:'25:00',created:'2026-11-23'}],Array(101).fill({})])assert.throws(()=>validateTasks(tasks));
console.log('키 검증·암호문 복호화·서명 검증·한국 시간/자정 일정·입력 검증 통과');

if(process.argv.includes('--preview')) {
  const base='http://localhost:5173/api/notifications/';
  const health=await fetch('http://localhost:5173/api/health').then(r=>r.json());
  assert(health.preview,'Only the local preview may be tested.');
  const token=randomBytes(32).toString('hex'),device=digest(token);
  const call=async(path,method='GET',body,bearer=token)=>{
    const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  };
  const sql=command=>{
    const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--json','--command',command],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout)[0].results;
  };
  const previewSecret=readFileSync(homedir()+'/.cache/baze/maeil-preview-notification-key','utf8');
  const tickToken=cronToken(process.env.NOTIFICATION_SECRET||previewSecret);
  try {
    assert.equal((await call('status','GET',null,'wrong')).status,401);
    assert.equal((await call('tick','POST',{})).status,401);
    assert.equal((await call('subscribe','POST',{subscription,tasks:[{id:'example',name:'예시: 검증 일정',time:'08:00',created:'2026-11-23'}]})).status,200);
    const other=await call('status','GET',null,randomBytes(32).toString('hex'));assert.equal(other.body.connected,false);
    assert.equal((await call('status')).body.connected,true);
    assert.equal(sql(`SELECT COUNT(*) AS n FROM notification_schedules WHERE device_id='${device}'`)[0].n,2);
    // Due timestamps are synthetic and older than the send window: no real push is sent.
    sql(`UPDATE notification_schedules SET next_at=1 WHERE device_id='${device}'`);
    const ticks=await Promise.all([call('tick','POST',{},tickToken),call('tick','POST',{},tickToken)]);
    assert(ticks.every(t=>t.status===200));
    assert.equal(ticks.reduce((sum,t)=>sum+t.body.skipped,0),2);
    assert.equal((await call('tick','POST',{},tickToken)).body.skipped,0);
    assert.equal((await call('tasks','PUT',{tasks:[]})).status,200);
    assert.equal(sql(`SELECT COUNT(*) AS n FROM notification_schedules WHERE device_id='${device}'`)[0].n,1);
    const fullTasks=Array.from({length:100},(_,i)=>({id:'example'+i,name:'예시: '+i,time:'08:00',created:'2026-11-23'}));
    assert.equal((await call('tasks','PUT',{tasks:fullTasks})).status,200);
    assert.equal(sql(`SELECT COUNT(*) AS n FROM notification_schedules WHERE device_id='${device}'`)[0].n,101);
    assert.equal((await call('tasks','PUT',{tasks:[{}]})).status,400);
    assert.equal((await call('subscription','DELETE')).status,200);
    assert.equal((await call('status')).body.connected,false);
    assert.equal(sql(`SELECT COUNT(*) AS n FROM notification_schedules WHERE device_id='${device}'`)[0].n,0);
    assert.equal((await call('tasks','PUT',{tasks:[]})).status,404);
    console.log('미리보기의 구독 저장·기기 분리·예약 동시 실행/중복 억제·일정 삭제·연결 삭제 통과 (실제 발송 없음)');
  } finally {await call('subscription','DELETE');}
}

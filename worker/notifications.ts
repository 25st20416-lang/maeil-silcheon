import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cronToken, deliver, digest, safeEqual, subscriptionFrom, vapidKeys } from './push';
import { advanceDue, scheduleStatements, validateTasks } from './schedules';

const app = new Hono<{ Bindings: Env; Variables: { device: string } }>();
const now = () => Date.now();
app.use('/api/*', async (c, next) => { await next();c.header('cache-control', 'no-store');c.header('x-content-type-options', 'nosniff'); });
app.use('/api/*', bodyLimit({ maxSize: 64000, onError: c => c.json({ error: '일정 정보가 너무 커요. 실천 개수를 줄여 주세요.' }, 413) }));
app.get('/api/health', c => c.json({ ok: true, notifications: !!c.env.NOTIFICATION_SECRET, preview: String(c.env.NOTIFICATION_MODE) === 'preview' }));
app.get('/api/notifications/config', async c => {
  const ready = !!c.env.NOTIFICATION_SECRET && c.env.NOTIFICATION_SECRET.length >= 24;
  const runtime = await c.env.DB.prepare('SELECT last_tick_at FROM notification_runtime WHERE id=1').first<{last_tick_at: number}>();
  return c.json({ ready, publicKey: ready ? vapidKeys(c.env.NOTIFICATION_SECRET).publicKey : null, lastTickAt: runtime?.last_tick_at || null, preview: String(c.env.NOTIFICATION_MODE) === 'preview' });
});

app.use('/api/notifications/*', async (c, next) => {
  if (c.req.path.endsWith('/config') || c.req.path.endsWith('/tick')) return next();
  if (!c.env.NOTIFICATION_SECRET || c.env.NOTIFICATION_SECRET.length < 24) return c.json({error:'알림 연결 준비가 아직 완료되지 않았어요.'},503);
  const token = c.req.header('Authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return c.json({ error: '이 기기에서 알림을 다시 켜 주세요.' }, 401);
  c.set('device', digest(token));
  const window = Math.floor(now() / 60000);
  const key = digest(c.env.NOTIFICATION_SECRET + (c.req.header('cf-connecting-ip') || 'preview') + window);
  const rate = await c.env.DB.prepare(`INSERT INTO notification_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).bind(key, now() + 120000).first<{count:number}>();
  if (rate && rate.count > 60) return c.json({error:'요청이 많아요. 잠시 뒤 다시 시도해 주세요.'},429);
  await next();
});
app.get('/api/notifications/status', async c => {
  const device = await c.env.DB.prepare('SELECT connected_at,updated_at,last_test_at,last_delivery_at,delivery_status FROM notification_devices WHERE device_id=?').bind(c.get('device')).first();
  return c.json({ connected: !!device, device: device || null });
});
app.post('/api/notifications/subscribe', async c => {
  const body = await c.req.json<{ subscription: unknown; tasks: unknown }>();
  const sub = subscriptionFrom(body.subscription), tasks = validateTasks(body.tasks), id = c.get('device'), timestamp = now();
  const existing = await c.env.DB.prepare('SELECT device_id FROM notification_devices WHERE endpoint_hash=?').bind(digest(sub.endpoint)).first<{device_id:string}>();
  if (existing && existing.device_id !== id) return c.json({error:'이 기기의 이전 연결이 남아 있어요. 알림을 껐다가 다시 켜 주세요.'},409);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO notification_devices(device_id,subscription,endpoint_hash,connected_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(device_id) DO UPDATE SET subscription=excluded.subscription,endpoint_hash=excluded.endpoint_hash,updated_at=excluded.updated_at,delivery_status='connected'`).bind(id,JSON.stringify(sub),digest(sub.endpoint),timestamp,timestamp),
    ...scheduleStatements(c.env.DB,id,tasks,timestamp),
  ]);
  return c.json({ok:true, savedAt:timestamp});
});
app.put('/api/notifications/tasks', async c => {
  const {tasks:value} = await c.req.json<{tasks: unknown}>(), id = c.get('device');
  const tasks = validateTasks(value);
  const exists = await c.env.DB.prepare('SELECT device_id FROM notification_devices WHERE device_id=?').bind(id).first();
  if (!exists) return c.json({error:'먼저 이 기기에서 알림을 켜 주세요.'},404);
  const timestamp = now();
  await c.env.DB.batch([c.env.DB.prepare('UPDATE notification_devices SET updated_at=? WHERE device_id=?').bind(timestamp,id),...scheduleStatements(c.env.DB,id,tasks,timestamp)]);
  return c.json({ok:true,savedAt:timestamp});
});
app.delete('/api/notifications/subscription', async c => {
  const id = c.get('device');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM notification_schedules WHERE device_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM notification_devices WHERE device_id=?').bind(id),
  ]);
  return c.json({ok:true});
});

async function recordDelivery(env: Env, id: string, status: number, timestamp: number) {
  const state = status >= 200 && status < 300 ? 'accepted' : status === 404 || status === 410 ? 'expired' : 'failed';
  await env.DB.prepare('UPDATE notification_devices SET delivery_status=?,last_delivery_at=? WHERE device_id=?').bind(state,timestamp,id).run();
  if (state === 'expired') await env.DB.prepare('DELETE FROM notification_schedules WHERE device_id=?').bind(id).run();
  return state;
}
app.post('/api/notifications/test', async c => {
  const id = c.get('device'), timestamp = now();
  const row = await c.env.DB.prepare(`UPDATE notification_devices SET last_test_at=? WHERE device_id=? AND last_test_at<? RETURNING subscription`).bind(timestamp,id,timestamp-60000).first<{subscription:string}>();
  if (!row) return c.json({error:'알림을 먼저 켜 주세요. 방금 테스트했다면 1분 뒤 다시 시도해 주세요.'},429);
  const sub = subscriptionFrom(JSON.parse(row.subscription));
  let status = 0;
  try { status = await deliver(sub,{body:'매일실천 테스트 알림이에요. 휴대폰에서 이 알림이 보이면 수신된 거예요.',tag:'maeil-test'},c.env.NOTIFICATION_SECRET,c.env.APP_URL); }
  catch { console.warn(JSON.stringify({event:'push_test_network_failure'})); }
  const result = await recordDelivery(c.env,id,status,timestamp);
  if (result !== 'accepted') return c.json({error:result==='expired'?'기기 연결이 만료됐어요. 알림을 다시 켜 주세요.':'발송 요청에 실패했어요. 인터넷을 확인하고 1분 뒤 다시 시도해 주세요.'},502);
  return c.json({ok:true,accepted:true,message:'알림 제공처가 발송 요청을 접수했어요. 휴대폰의 실제 알림을 확인해 주세요.'});
});

app.post('/api/notifications/tick', async c => {
  const provided = c.req.header('Authorization')?.replace(/^Bearer /,'') || '';
  if (!c.env.NOTIFICATION_SECRET || !safeEqual(provided,cronToken(c.env.NOTIFICATION_SECRET))) return c.json({error:'실행 권한이 없어요.'},401);
  const timestamp = now();
  await c.env.DB.prepare('UPDATE notification_runtime SET last_tick_at=? WHERE id=1').bind(timestamp).run();
  const {results} = await c.env.DB.prepare(`SELECT s.*,d.subscription FROM notification_schedules s JOIN notification_devices d ON d.device_id=s.device_id WHERE s.next_at<=? ORDER BY s.next_at LIMIT 10`).bind(timestamp).all<{device_id:string;task_id:string;name:string;time:string;next_at:number;subscription:string}>();
  let accepted = 0, failed = 0, skipped = 0;
  for (const row of results) {
    // Advance first: a conditional atomic claim prevents concurrent or repeated sends.
    const claim = await c.env.DB.prepare('UPDATE notification_schedules SET next_at=? WHERE device_id=? AND task_id=? AND next_at=? RETURNING task_id').bind(advanceDue(row.next_at,timestamp),row.device_id,row.task_id,row.next_at).first();
    if (!claim) continue;
    if (row.next_at < timestamp-1800000) {skipped++;continue;}
    // A disable/delete after selection must take effect before we send.
    const current = await c.env.DB.prepare('SELECT subscription FROM notification_devices WHERE device_id=? AND EXISTS(SELECT 1 FROM notification_schedules WHERE device_id=? AND task_id=?)').bind(row.device_id,row.device_id,row.task_id).first<{subscription:string}>();
    if (!current) {skipped++;continue;}
    const body = row.task_id==='__morning__'?'좋은 아침이에요. 오늘의 실천을 하나씩 시작해 보세요.':`${row.time}에 “${row.name}” 실천이 있어요. 미리 준비해 보세요.`;
    let status = 0;
    try { status = await deliver(subscriptionFrom(JSON.parse(current.subscription)),{body,tag:digest(row.device_id+row.task_id+row.next_at).slice(0,30)},c.env.NOTIFICATION_SECRET,c.env.APP_URL); }
    catch { console.warn(JSON.stringify({event:'push_reminder_failure'})); }
    const result = await recordDelivery(c.env,row.device_id,status,timestamp);
    if (result === 'accepted') accepted++;else failed++;
  }
  await c.env.DB.prepare('DELETE FROM notification_limits WHERE key IN (SELECT key FROM notification_limits WHERE expires_at<? LIMIT 100)').bind(timestamp).run();
  return c.json({ok:true,accepted,failed,skipped,more:results.length===10});
});
app.all('/api/*', c => c.json({error:'사용할 수 없는 요청이에요.'},404));
app.notFound(c => c.env.ASSETS.fetch(c.req.raw));
app.onError((err,c) => {
  if (err instanceof SyntaxError) return c.json({error:'요청 내용을 다시 확인해 주세요.'},400);
  const validation = err.message.startsWith('구독') || err.message.startsWith('알림 주소') || err.message.startsWith('지원하는') || err.message.startsWith('기기 알림') || err.message.startsWith('실천은') || err.message.startsWith('일정 이름');
  if (validation) return c.json({error:err.message},400);
  console.error(JSON.stringify({event:'notification_request_failure',path:c.req.path,name:err.name}));
  return c.json({error:'알림 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},500);
});
export default app;

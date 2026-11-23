import { createECDH, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import webpush from 'web-push';

export function vapidKeys(secret: string) {
  // Domain-separated, stable key derivation. Neither key material nor the master is logged.
  let bytes = createHmac('sha256', secret).update('maeil-vapid-v1').digest();
  const key = createECDH('prime256v1');
  for (let i = 0; i < 10; i++) {
    try {
      key.setPrivateKey(bytes);
      const raw=key.getPrivateKey();
      return { publicKey: key.getPublicKey().toString('base64url'), privateKey: Buffer.concat([Buffer.alloc(32-raw.length),raw]).toString('base64url') };
    } catch { bytes = createHash('sha256').update(bytes).digest(); }
  }
  throw new Error('VAPID key derivation failed');
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const cronToken = (secret: string) => createHmac('sha256', secret).update('maeil-cron-v1').digest('hex');
export const safeEqual = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function subscriptionFrom(value: unknown): webpush.PushSubscription {
  if (!value || typeof value !== 'object') throw new Error('구독 정보를 확인해 주세요.');
  const sub = value as Record<string, unknown>;
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 4096) throw new Error('알림 주소가 올바르지 않아요.');
  let url: URL;try {url = new URL(sub.endpoint);} catch {throw new Error('알림 주소가 올바르지 않아요.');}
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !allowed.includes(url.hostname)) throw new Error('지원하는 알림 제공 주소가 아니에요.');
  const keys = sub.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' ||
      !/^[\w-]{87}$/.test(keys.p256dh) || !/^[\w-]{22}$/.test(keys.auth) ||
      Buffer.from(keys.p256dh, 'base64url')[0] !== 4) throw new Error('기기 알림 정보를 다시 등록해 주세요.');
  // Reject invalid elliptic-curve points before storing them.
  try {const point = createECDH('prime256v1');point.generateKeys();point.computeSecret(Buffer.from(keys.p256dh, 'base64url'));}
  catch {throw new Error('기기 알림 정보를 다시 등록해 주세요.');}
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function deliver(subscription: webpush.PushSubscription, message: {body: string; tag: string}, secret: string, subject: string, fetcher: typeof fetch = fetch) {
  const details = webpush.generateRequestDetails(subscription, JSON.stringify(message), {
    vapidDetails: { ...vapidKeys(secret), subject },
    contentEncoding: 'aes128gcm', TTL: 300, urgency: 'normal',
  });
  const response = await fetcher(details.endpoint, {
    method: details.method, headers: details.headers,
    body: new Uint8Array(details.body), redirect: 'error', signal: AbortSignal.timeout(12000),
  });
  await response.body?.cancel();
  return response.status;
}

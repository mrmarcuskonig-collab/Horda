// storage.test.ts — object-storage adapter. The SigV4 signer is verified against
// AWS's published "single chunk" example so we know the crypto is correct without
// a live bucket; storeImage is verified with an injected fetch + env.
// Run: node tests/storage.test.ts
import { createHash } from 'node:crypto';
import { sigV4Authorization, storeImage, storageEnabled } from '../src/web/storage.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[storage · SigV4 signer (AWS published vector)]');
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-auth-using-authorization-header.html
const payload = 'Welcome to Amazon S3.';
const payloadHash = createHash('sha256').update(payload).digest('hex');
ok('payload hash matches AWS example', payloadHash === '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072');
const auth = sigV4Authorization({
  method: 'PUT',
  host: 'examplebucket.s3.amazonaws.com',
  canonicalUri: '/test%24file.text',
  region: 'us-east-1',
  service: 's3',
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  amzDate: '20130524T000000Z',
  payloadHash,
  headers: {
    'date': 'Fri, 24 May 2013 00:00:00 GMT',
    'host': 'examplebucket.s3.amazonaws.com',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': '20130524T000000Z',
    'x-amz-storage-class': 'REDUCED_REDUNDANCY',
  },
});
ok('signature exactly matches AWS expected value',
  auth.includes('Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd'));
ok('authorization names the right signed headers + credential scope',
  auth.includes('SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class') &&
  auth.includes('Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request'));

console.log('\n[storage · storeImage fallback when unconfigured]');
const fake = () => { throw new Error('should not be called when unconfigured'); };
ok('storage disabled without env', !storageEnabled());
const dataUrl = 'data:image/png;base64,' + Buffer.from('hello').toString('base64');
ok('unconfigured → returns the data URL unchanged (inline-in-DB)', (await storeImage(dataUrl, 'uploads', fake as any)) === dataUrl);
ok('null passes through', (await storeImage(null)) === null);

console.log('\n[storage · storeImage uploads when configured]');
process.env.S3_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
process.env.S3_BUCKET = 'horda';
process.env.S3_ACCESS_KEY_ID = 'AKIA_TEST';
process.env.S3_SECRET_ACCESS_KEY = 'secret_test';
process.env.S3_PUBLIC_BASE = 'https://cdn.joinhorda.com';
process.env.S3_REGION = 'auto';

let putUrl = '', putInit: any = null;
const okFetch: any = async (u: string, init: any) => { putUrl = u; putInit = init; return { ok: true, status: 200, text: async () => '' }; };

const url = await storeImage(dataUrl, 'avatars', okFetch);
ok('returns a public CDN url', !!url && url.startsWith('https://cdn.joinhorda.com/avatars/') && url.endsWith('.png'));
ok('PUTs to the bucket endpoint (path-style)', putUrl.startsWith('https://acct.r2.cloudflarestorage.com/horda/avatars/'));
ok('request is a signed PUT', putInit.method === 'PUT' && String(putInit.headers.Authorization).startsWith('AWS4-HMAC-SHA256 Credential=AKIA_TEST/'));
ok('sends content-type + payload hash headers', putInit.headers['content-type'] === 'image/png' && !!putInit.headers['x-amz-content-sha256']);
ok('body is the decoded bytes', Buffer.from(putInit.body).toString() === 'hello');

const httpUrl = 'https://example.com/already-hosted.jpg';
ok('already-hosted http url is left untouched', (await storeImage(httpUrl, 'avatars', okFetch)) === httpUrl);

// upload failure → fall back to inline rather than lose the image
const badFetch: any = async () => ({ ok: false, status: 500, text: async () => 'err' });
ok('upload failure falls back to the data URL', (await storeImage(dataUrl, 'avatars', badFetch)) === dataUrl);

for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE', 'S3_REGION']) delete process.env[k];

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);

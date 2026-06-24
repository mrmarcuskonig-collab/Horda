// storage.ts — move uploaded images out of the database into object storage
// (S3, Cloudflare R2, Backblaze B2 — anything S3-compatible). We sign requests
// ourselves with AWS Signature V4 (no SDK), so the only dependency is fetch.
//
// Adapter pattern, same as payments/email/AI: with the S3_* env vars set →
// uploads are PUT to the bucket and we store the public URL. Without them →
// storeImage() returns the original data URL unchanged (inline-in-DB fallback,
// i.e. exactly today's behavior). So nothing breaks when it isn't configured.
import { createHash, createHmac, randomUUID } from 'node:crypto';

const sha256hex = (d: Buffer | string): string => createHash('sha256').update(d).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data, 'utf8').digest();

export interface SigV4Input {
  method: string;
  host: string;
  canonicalUri: string;        // URI-encoded path, e.g. /bucket/uploads/abc.png
  region: string;
  service: string;             // 's3'
  accessKey: string;
  secretKey: string;
  amzDate: string;             // 20130524T000000Z
  payloadHash: string;         // hex sha256 of body (or 'UNSIGNED-PAYLOAD')
  headers: Record<string, string>; // header name(lowercased) → value; MUST include host + x-amz-date
}

// Pure SigV4 signer. Returns the Authorization header value. Verified in tests
// against AWS's published "single chunk" example vector.
export function sigV4Authorization(i: SigV4Input): string {
  const dateStamp = i.amzDate.slice(0, 8);
  const sortedKeys = Object.keys(i.headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${i.headers[Object.keys(i.headers).find(h => h.toLowerCase() === k)!].trim()}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [i.method, i.canonicalUri, '', canonicalHeaders, signedHeaders, i.payloadHash].join('\n');
  const scope = `${dateStamp}/${i.region}/${i.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', i.amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + i.secretKey, dateStamp);
  const kRegion = hmac(kDate, i.region);
  const kService = hmac(kRegion, i.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${i.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/');
const amzNow = (): string => new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

export interface StorageCfg { endpoint: string; bucket: string; region: string; accessKey: string; secretKey: string; publicBase: string }
type Fetcher = typeof fetch;

export class S3Storage {
  readonly enabled = true;
  private cfg: StorageCfg;
  private fetcher: Fetcher;
  constructor(cfg: StorageCfg, fetcher: Fetcher = fetch) { this.cfg = cfg; this.fetcher = fetcher; }

  // Upload raw bytes; returns the public URL.
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const host = new URL(this.cfg.endpoint).host;
    const canonicalUri = '/' + encodeKey(`${this.cfg.bucket}/${key}`);
    const amzDate = amzNow();
    const payloadHash = sha256hex(body);
    const headers: Record<string, string> = {
      host,
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const authorization = sigV4Authorization({
      method: 'PUT', host, canonicalUri, region: this.cfg.region, service: 's3',
      accessKey: this.cfg.accessKey, secretKey: this.cfg.secretKey, amzDate, payloadHash, headers,
    });
    const r = await this.fetcher(`${this.cfg.endpoint}${canonicalUri}`, {
      method: 'PUT',
      headers: { ...headers, Authorization: authorization },
      body,
    } as any);
    if (!(r as any).ok) throw new Error('storage: PUT failed ' + (r as any).status);
    return `${this.cfg.publicBase.replace(/\/$/, '')}/${key}`;
  }
}

// Parse a base64 data URL → { contentType, bytes }. Returns null for anything
// that isn't a base64 data URL (e.g. http URLs, or the utf8 SVG covers), which
// we leave untouched.
function parseDataUrl(s: string): { contentType: string; bytes: Buffer; ext: string } | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(s);
  if (!m) return null;
  const contentType = m[1];
  const ext = contentType.split('/')[1]?.replace('+xml', '').replace('jpeg', 'jpg') || 'bin';
  try { return { contentType, bytes: Buffer.from(m[2], 'base64'), ext }; } catch { return null; }
}

let _storage: S3Storage | null | undefined;
function storage(fetcher?: Fetcher): S3Storage | null {
  if (_storage !== undefined && !fetcher) return _storage;
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) { _storage = null; return null; }
  const cfg: StorageCfg = {
    endpoint: S3_ENDPOINT.replace(/\/$/, ''), bucket: S3_BUCKET,
    region: process.env.S3_REGION || 'auto',
    accessKey: S3_ACCESS_KEY_ID, secretKey: S3_SECRET_ACCESS_KEY,
    publicBase: process.env.S3_PUBLIC_BASE || `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}`,
  };
  const s = new S3Storage(cfg, fetcher);
  if (!fetcher) _storage = s;
  return s;
}

export function storageEnabled(): boolean { return storage() !== null; }

// The one function callers use. Give it whatever is in a `*_url` field; get back
// a URL to persist. If it's a base64 image and storage is configured, it's
// uploaded and a CDN URL comes back; otherwise the input is returned unchanged.
export async function storeImage(value: string | null | undefined, prefix = 'uploads', fetcher?: Fetcher): Promise<string | null> {
  if (!value) return value ?? null;
  const s = storage(fetcher);
  if (!s) return value;                     // not configured → keep inline (today's behavior)
  const parsed = parseDataUrl(value);
  if (!parsed) return value;                // not a base64 image (http URL, svg cover) → leave as-is
  const key = `${prefix}/${randomUUID()}.${parsed.ext}`;
  try { return await s.put(key, parsed.bytes, parsed.contentType); }
  catch { return value; }                   // upload failed → fall back to inline rather than lose the image
}

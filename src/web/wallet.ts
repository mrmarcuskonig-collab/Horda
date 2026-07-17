// wallet.ts — the ticket in Apple Wallet / Google Wallet.
//
// WHY IT MATTERS MORE THAN IT LOOKS
// ---------------------------------
// A web pass needs signal, a browser, a login and a fan who remembers which tab
// it was in — at a stadium gate, on a dead phone, in the rain. A Wallet pass is
// offline, on the lock screen, and surfaces itself at the right time and place.
// Every ticketing product that skips this discovers it again at the first door.
//
// WHAT YOU HAVE TO BUY (this is not a code problem)
// -------------------------------------------------
// Neither wallet lets you generate a pass anonymously. Both are gated on an
// identity you must go and obtain:
//
//   APPLE  — an Apple Developer Program membership (€99/yr), plus a Pass Type ID
//            and its signing certificate. A .pkpass is a ZIP whose manifest is
//            signed with that cert (PKCS#7). No cert, no pass. There is no free
//            tier and no way around it.
//   GOOGLE — a Google Cloud project, the Google Wallet API enabled, an Issuer ID
//            from the Google Pay & Wallet Console, and a service-account key. Free,
//            but the issuer account needs approval before it works in production.
//
// Until those exist, this module reports "not configured" and the pass UI says so
// honestly rather than showing a button that does nothing. A dead "Add to Wallet"
// button is worse than no button: the fan taps it AT THE DOOR.
//
// SECURITY POSTURE: the signing key is the ticket printing press. It lives in an
// env var on Render, is read here and nowhere else, and is never logged, never
// echoed into a page, and never written to disk by us.
import { createSign, createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

export interface PassData {
  token: string;            // the QR payload — same token the scanner checks
  eventTitle: string;
  hostName: string;
  startsAt: string | null;  // ISO instant
  timezone: string | null;
  location: string | null;
  formatLabel: string | null;
  fanName: string;
  eventUrl: string;
}

// --- configuration ---------------------------------------------------------
export interface WalletStatus { apple: boolean; google: boolean }
export function walletStatus(): WalletStatus {
  return {
    apple: !!(process.env.APPLE_PASS_CERT_PEM && process.env.APPLE_PASS_KEY_PEM
      && process.env.APPLE_PASS_WWDR_PEM && process.env.APPLE_PASS_TYPE_ID && process.env.APPLE_TEAM_ID),
    google: !!(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SA_EMAIL && process.env.GOOGLE_WALLET_SA_KEY),
  };
}

// --- Google Wallet ---------------------------------------------------------
// Google takes a signed JWT in a link. No ZIP, no certificate chain — just RS256
// over a JSON claim set, which node:crypto does natively. This is why Google is
// the one that can ship first.
const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function googleWalletUrl(p: PassData): string | null {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const email = process.env.GOOGLE_WALLET_SA_EMAIL;
  // Render strips real newlines from env values; the standard workaround is \n
  // escapes in the var, unescaped here. Getting this wrong produces a completely
  // opaque "invalid key" from the crypto layer, hence the explicit handling.
  const key = (process.env.GOOGLE_WALLET_SA_KEY || '').replace(/\\n/g, '\n');
  if (!issuer || !email || !key) return null;

  const classId = `${issuer}.horda_event`;
  const objectId = `${issuer}.${p.token}`;
  const payload = {
    iss: email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [] as string[],
    payload: {
      eventTicketObjects: [{
        id: objectId,
        classId,
        state: 'ACTIVE',
        // The barcode carries the SAME token the door scanner reads. One
        // credential, three surfaces (web pass, Apple, Google) — a wallet-only
        // code would be a second thing to keep in sync, and it would drift.
        barcode: { type: 'QR_CODE', value: p.token, alternateText: p.token.slice(0, 8).toUpperCase() },
        ticketHolderName: p.fanName,
        eventName: { defaultValue: { language: 'en-US', value: p.eventTitle } },
        venue: p.location ? { name: { defaultValue: { language: 'en-US', value: p.location } } } : undefined,
        dateTime: p.startsAt ? { start: p.startsAt } : undefined,
        linksModuleData: { uris: [{ uri: p.eventUrl, description: 'Event on Horda' }] },
      }],
    },
  };
  try {
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify(payload));
    const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key);
    return `https://pay.google.com/gp/v/save/${head}.${body}.${b64url(sig)}`;
  } catch {
    // A malformed key must not take the pass page down — the fan still has a QR.
    return null;
  }
}

// --- Apple Wallet (.pkpass) ------------------------------------------------
// A .pkpass is a ZIP of: pass.json, manifest.json (SHA-1 of every file), and
// signature (a detached PKCS#7 of the manifest). Everything below is buildable
// offline EXCEPT the signature, which needs the paid certificate.
export function passJson(p: PassData): string {
  const relevant = p.startsAt ? { relevantDate: p.startsAt } : {};
  return JSON.stringify({
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: 'Horda',
    serialNumber: p.token,
    description: `${p.eventTitle} — Horda ticket`,
    // Brand: the arena theme, so the pass in the lock screen is unmistakably ours.
    backgroundColor: 'rgb(35,32,32)',
    foregroundColor: 'rgb(237,233,223)',
    labelColor: 'rgb(225,90,64)',
    logoText: 'Horda',
    ...relevant,
    barcodes: [{ format: 'PKBARCODE_FORMAT_QR', message: p.token, messageEncoding: 'iso-8859-1', altText: p.token.slice(0, 8).toUpperCase() }],
    eventTicket: {
      primaryFields: [{ key: 'event', label: 'EVENT', value: p.eventTitle }],
      secondaryFields: [
        { key: 'when', label: 'WHEN', value: p.startsAt ?? 'TBA', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleShort' },
        p.location ? { key: 'where', label: 'WHERE', value: p.location } : null,
      ].filter(Boolean),
      auxiliaryFields: [
        { key: 'holder', label: 'TICKET HOLDER', value: p.fanName },
        p.formatLabel ? { key: 'how', label: 'ATTENDING VIA', value: p.formatLabel } : null,
      ].filter(Boolean),
      backFields: [
        { key: 'host', label: 'Hosted by', value: p.hostName },
        // Identity-bound is stated ON the pass, not just in the AGB. The claim
        // "this ticket is yours and only yours" has to survive contact with the
        // person holding the phone.
        { key: 'terms', label: 'Ticket terms', value: 'This ticket is personal and non-transferable. Bring ID matching the name on the pass if asked.' },
        { key: 'link', label: 'Event', value: p.eventUrl },
      ],
    },
  }, null, 2);
}

/** SHA-1 manifest — Apple's format, not our choice. */
export function passManifest(files: Record<string, Buffer>): string {
  const m: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) m[name] = createHash('sha1').update(buf).digest('hex');
  return JSON.stringify(m, null, 2);
}

/**
 * Minimal ZIP writer (store + deflate), enough for a .pkpass.
 *
 * Hand-rolled rather than pulled in: a ZIP with a handful of small files is a
 * well-specified 80 lines, and this runs on a route that hands out tickets — the
 * dependency surface there is worth keeping at zero.
 */
export function zip(files: Record<string, Buffer>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })();
  const crc32 = (b: Buffer) => { let c = -1; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };

  for (const [name, raw] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = deflateRawSync(raw);
    // Only compress when it actually helps; a tiny JSON often deflates larger.
    const useDeflate = comp.length < raw.length;
    const data = useDeflate ? comp : raw;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);                       // version needed
    local.writeUInt16LE(0, 6);                        // flags
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);       // method
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);   // dos time/date (zeroed: reproducible builds)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32); cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

/**
 * Build a signed .pkpass. Returns null when the certificate isn't configured —
 * which is the state today, and the reason the UI must not promise Apple Wallet.
 *
 * The signature is a detached PKCS#7/CMS over manifest.json. node:crypto cannot
 * produce CMS, so this shells out to openssl (present in node:22-slim). That is
 * a deliberate, contained trade: the alternative is a crypto dependency in the
 * ticket path.
 */
export async function buildPkpass(p: PassData): Promise<Buffer | null> {
  if (!walletStatus().apple) return null;
  try {
    const files: Record<string, Buffer> = { 'pass.json': Buffer.from(passJson(p), 'utf8') };
    const manifest = Buffer.from(passManifest(files), 'utf8');
    const sig = await signManifest(manifest);
    if (!sig) return null;
    return zip({ ...files, 'manifest.json': manifest, 'signature': sig });
  } catch {
    return null;
  }
}

async function signManifest(manifest: Buffer): Promise<Buffer | null> {
  const { execFile } = await import('node:child_process');
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  // The private key touches disk for the length of one openssl call, in a
  // 0700 temp dir, and is removed in a finally. Not ideal — the alternative is
  // shipping a CMS implementation, which is worse.
  const dir = await mkdtemp(join(tmpdir(), 'hzpass-'));
  try {
    await writeFile(join(dir, 'manifest.json'), manifest);
    await writeFile(join(dir, 'cert.pem'), process.env.APPLE_PASS_CERT_PEM!.replace(/\\n/g, '\n'));
    await writeFile(join(dir, 'key.pem'), process.env.APPLE_PASS_KEY_PEM!.replace(/\\n/g, '\n'), { mode: 0o600 });
    await writeFile(join(dir, 'wwdr.pem'), process.env.APPLE_PASS_WWDR_PEM!.replace(/\\n/g, '\n'));
    await new Promise<void>((res, rej) => execFile('openssl', [
      'smime', '-binary', '-sign',
      '-certfile', join(dir, 'wwdr.pem'),
      '-signer', join(dir, 'cert.pem'),
      '-inkey', join(dir, 'key.pem'),
      '-in', join(dir, 'manifest.json'),
      '-out', join(dir, 'signature'),
      '-outform', 'DER',
    ], e => e ? rej(e) : res()));
    return await readFile(join(dir, 'signature'));
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

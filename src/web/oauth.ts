// oauth.ts — "Continue with Google" (and other common providers) via standard
// OAuth2. Each provider turns on only when its client id + secret are set in the
// env, so dev/tests stay password-only. Adding a provider is one registry entry.
// Apple needs an extra signed-JWT client secret — noted as a follow-up.

interface ProviderDef {
  label: string; env: string;        // env prefix, e.g. GOOGLE → GOOGLE_CLIENT_ID / _CLIENT_SECRET
  authUrl: string; tokenUrl: string; userUrl: string; scope: string;
  parseUser: (u: any) => { email: string; name: string };
}
const REG: Record<string, ProviderDef> = {
  google: {
    label: 'Google', env: 'GOOGLE',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    parseUser: u => ({ email: u.email, name: u.name || u.given_name || u.email }),
  },
  facebook: {
    label: 'Facebook', env: 'FACEBOOK',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    scope: 'email public_profile',
    parseUser: u => ({ email: u.email, name: u.name || u.email }),
  },
};
const cid = (p: string) => process.env[REG[p].env + '_CLIENT_ID'];
const csec = (p: string) => process.env[REG[p].env + '_CLIENT_SECRET'];

export function isEnabled(p: string): boolean { return !!(REG[p] && cid(p) && csec(p)); }
export function oauthProviders(): { id: string; label: string }[] {
  return Object.keys(REG).filter(isEnabled).map(p => ({ id: p, label: REG[p].label }));
}
export function authUrl(p: string, redirectUri: string, state: string): string {
  const r = REG[p];
  const u = new URLSearchParams({ client_id: cid(p)!, redirect_uri: redirectUri, response_type: 'code', scope: r.scope, state, access_type: 'online', prompt: 'select_account' });
  return r.authUrl + '?' + u.toString();
}
export async function exchange(p: string, code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<{ email: string; name: string } | null> {
  const r = REG[p];
  if (!r) return null;
  const body = new URLSearchParams({ client_id: cid(p)!, client_secret: csec(p)!, code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const tr = await fetcher(r.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body } as any);
  const tok: any = await tr.json();
  if (!tok?.access_token) return null;
  const ur = await fetcher(r.userUrl, { headers: { authorization: 'Bearer ' + tok.access_token } } as any);
  const user: any = await ur.json();
  const { email, name } = r.parseUser(user);
  return email ? { email, name } : null;
}

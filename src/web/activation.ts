// activation.ts — the onboarding→activation backbone. A role-aware "finish your
// setup" checklist whose steps AUTO-CHECK from real data (follows, RSVPs, tiers,
// posts, events). Operationalizes Patreon's "first 30 days decide retention".
// Self-contained inline styles (uses the theme CSS vars present on every page);
// dismissible via localStorage; auto-hides once every step is done.
import type { Database } from '../db/index.ts';
import { esc } from './layout.ts';
import { listProfileEvents } from '../db/events_repo.ts';
import { getBranding } from '../db/entity_repo.ts';

export interface Step { label: string; done: boolean; href: string }
export interface Checklist { title: string; steps: Step[]; complete: boolean; storageKey: string }

const n = async (db: Database, sql: string, params: any[]): Promise<number> =>
  (await db.query<{ n: number }>(sql, params)).rows[0]?.n ?? 0;

export async function fanChecklist(db: Database, fanId: string): Promise<Checklist> {
  const follows = await n(db, `SELECT count(*)::int n FROM follow WHERE fan_id=$1`, [fanId]);
  const claims = await n(db, `SELECT count(*)::int n FROM claim WHERE fan_id=$1`, [fanId]);
  const pres = await n(db, `SELECT count(*)::int n FROM presence WHERE fan_id=$1`, [fanId]);
  const steps: Step[] = [
    { label: 'Follow 3 crowds you love', done: follows >= 3, href: '/' },
    { label: 'Claim your first event', done: claims > 0, href: '/' },
    { label: 'Show up — earn your first verified presence', done: pres > 0, href: '/record' },
  ];
  return { title: 'Finish setting up your Horda', steps, complete: steps.every(s => s.done), storageKey: 'hz_act_fan' };
}

export async function athleteChecklist(db: Database, athleteId: string): Promise<Checklist> {
  const a = (await db.query<{ avatar_url: string | null; banner_url: string | null }>(`SELECT avatar_url, banner_url FROM athlete WHERE id=$1`, [athleteId])).rows[0] ?? { avatar_url: null, banner_url: null };
  const events = (await listProfileEvents(db, 'athlete', athleteId)).length;
  const here = `/athlete/${athleteId}`;
  const edit = `${here}/customize`;
  // Keep first-run light: no tiers, no drops, and no "connect to clubs" step —
  // every entity just follows everyone for now, so setup is a real page and your
  // first claimable event. (Real club↔athlete relationships come later.)
  const steps: Step[] = [
    { label: 'Your page is live', done: true, href: here },
    { label: 'Add a profile photo & banner', done: !!a.avatar_url && !!a.banner_url, href: edit },
    { label: 'Schedule your first event', done: events > 0, href: `/host/athlete/${athleteId}/new` },
  ];
  return { title: 'Finish setting up your page', steps, complete: steps.every(s => s.done), storageKey: `hz_act_ath_${athleteId}` };
}

export async function entityChecklist(db: Database, kind: string, id: string): Promise<Checklist> {
  const b = await getBranding(db, kind, id);
  const events = (await listProfileEvents(db, kind, id)).length;
  const here = `/${kind}/${id}`;
  // Doctrine: no posts/drops, and no "connect to a league" step for now — every
  // entity follows everyone; real org relationships come later.
  const steps: Step[] = [
    { label: 'Page claimed & verified', done: true, href: here },
    { label: 'Set up your look — badge & banner', done: !!b.avatarUrl || !!b.bannerUrl, href: here },
    { label: 'Add your first event', done: events > 0, href: `/host/${kind}/${id}/new` },
  ];
  return { title: 'Finish setting up your page', steps, complete: steps.every(s => s.done), storageKey: `hz_act_${kind}_${id}` };
}

// Self-contained card. Returns '' when complete (nothing to nag about).
export function renderChecklist(c: Checklist): string {
  if (c.complete) return '';
  const total = c.steps.length;
  const done = c.steps.filter(s => s.done).length;
  const pct = Math.round((done / total) * 100);
  const dot = (ok: boolean) => ok
    ? `<span style="flex:0 0 20px;width:20px;height:20px;border-radius:50%;background:var(--bone);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">✓</span>`
    : `<span style="flex:0 0 20px;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--b);display:block"></span>`;
  const rows = c.steps.map(s => `<a href="${s.href}" style="display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid var(--b);color:inherit;text-decoration:none">${dot(s.done)}<span style="font-size:14px;${s.done ? 'color:var(--mut);text-decoration:line-through' : ''}">${esc(s.label)}</span></a>`).join('');
  return `<section id="actck" class="card" style="border:1px solid var(--b);border-radius:16px;padding:16px 18px;margin:0 0 14px;background:var(--s)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <strong style="font-size:15px">${esc(c.title)}</strong>
      <button type="button" onclick="try{localStorage.setItem('${c.storageKey}','1')}catch(e){};var e=document.getElementById('actck');if(e)e.style.display='none'" style="background:transparent;border:0;color:var(--mut);font-size:12px;cursor:pointer;padding:4px">Dismiss</button>
    </div>
    <div style="font-size:12px;color:var(--mut);margin:3px 0 8px">${done} of ${total} done</div>
    <div style="height:6px;border-radius:999px;background:var(--ink);border:1px solid var(--b);overflow:hidden;margin-bottom:6px"><span style="display:block;height:100%;width:${pct}%;background:var(--bone)"></span></div>
    ${rows}
  </section>
  <script>(function(){try{if(localStorage.getItem('${c.storageKey}')==='1'){var e=document.getElementById('actck');if(e)e.style.display='none'}}catch(e){}})();</script>`;
}

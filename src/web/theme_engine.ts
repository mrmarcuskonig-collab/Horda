// theme_engine.ts — §4a "your corner of Horda". Constrained generation, not
// free-form design: an athlete customizes within a THEME SCHEMA (tokens), never
// layout primitives. The same ThemeSpec renders the banner, the OG image, and
// every share asset, so the athlete's brand propagates everywhere.
import { ravenMark } from './brand.ts';

export interface ThemeSpec {
  bg: string;         // banner background
  fg: string;         // primary text (auto-contrasted on save)
  accent: string;     // sport chip / underline / highlight
  type: 'bold' | 'condensed' | 'wide' | 'serif' | 'mono';
  overlay: 'none' | 'gradient' | 'grain' | 'stripes' | 'spotlight';
}

// Curated preset themes (Layer 2). Each is a complete, on-brand starting point —
// no empty/ugly defaults ever. Athletes tint these to their media.
export const THEME_PRESETS: { id: string; name: string; spec: ThemeSpec }[] = [
  { id: 'ink', name: 'Ink', spec: { bg: '#0B0B0C', fg: '#EDE9DF', accent: '#E5484D', type: 'bold', overlay: 'stripes' } },
  { id: 'blood', name: 'Blood', spec: { bg: '#160708', fg: '#F4E9E7', accent: '#E5484D', type: 'condensed', overlay: 'spotlight' } },
  { id: 'gold', name: 'Champion', spec: { bg: '#12100A', fg: '#F6EFDD', accent: '#E7B84B', type: 'serif', overlay: 'gradient' } },
  { id: 'electric', name: 'Electric', spec: { bg: '#0A0F1E', fg: '#EAF1FF', accent: '#4C7DF6', type: 'wide', overlay: 'grain' } },
  { id: 'pitch', name: 'Pitch', spec: { bg: '#08140C', fg: '#E7F4EA', accent: '#3FB950', type: 'bold', overlay: 'stripes' } },
  { id: 'sunset', name: 'Sunset', spec: { bg: '#1A0A12', fg: '#FCEAF0', accent: '#FF6B6B', type: 'condensed', overlay: 'gradient' } },
  { id: 'bone', name: 'Bone', spec: { bg: '#EDE9DF', fg: '#141310', accent: '#0B0B0C', type: 'wide', overlay: 'none' } },
  { id: 'mono', name: 'Concrete', spec: { bg: '#1B1B1D', fg: '#EDEDED', accent: '#9AA0A6', type: 'mono', overlay: 'grain' } },
];

const COMBAT = ['boxing', 'mma', 'kickboxing', 'muay_thai', 'wrestling', 'judo', 'bjj', 'karate', 'taekwondo'];
const PITCH = ['football', 'futsal', 'rugby', 'american_football', 'field_hockey'];

// A wow default keyed off sport — combat leans Blood, football Pitch, etc.
export function defaultThemeForSport(sport: string | null | undefined): ThemeSpec {
  const s = (sport || '').toLowerCase();
  if (COMBAT.includes(s)) return THEME_PRESETS[1].spec;
  if (PITCH.includes(s)) return THEME_PRESETS[4].spec;
  if (['running', 'cycling', 'triathlon', 'swimming', 'athletics'].includes(s)) return THEME_PRESETS[3].spec;
  return THEME_PRESETS[0].spec;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const TYPES = ['bold', 'condensed', 'wide', 'serif', 'mono'];
const OVERLAYS = ['none', 'gradient', 'grain', 'stripes', 'spotlight'];

// Parse stored JSON into a valid ThemeSpec (tokens only, all validated).
export function parseTheme(raw: string | null | undefined, sport?: string | null): ThemeSpec {
  const d = defaultThemeForSport(sport);
  if (!raw) return d;
  try {
    const p = JSON.parse(raw);
    return {
      bg: HEX.test(p.bg) ? p.bg : d.bg,
      fg: HEX.test(p.fg) ? p.fg : d.fg,
      accent: HEX.test(p.accent) ? p.accent : d.accent,
      type: TYPES.includes(p.type) ? p.type : d.type,
      overlay: OVERLAYS.includes(p.overlay) ? p.overlay : d.overlay,
    };
  } catch { return d; }
}
export function serializeTheme(t: ThemeSpec): string { return JSON.stringify(t); }

// Relative luminance → auto-contrast the text against the chosen background.
function lum(hex: string): number {
  const n = hex.replace('#', ''); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export function autoContrast(t: ThemeSpec): ThemeSpec {
  const wantLight = lum(t.bg) < 0.5;
  const fgOk = wantLight ? lum(t.fg) > 0.5 : lum(t.fg) < 0.5;
  return fgOk ? t : { ...t, fg: wantLight ? '#F4F1EA' : '#141310' };
}

const TYPE_CSS: Record<string, { ff: string; w: number; ls: number; up: boolean }> = {
  bold: { ff: 'Helvetica,Arial,sans-serif', w: 800, ls: -2, up: true },
  condensed: { ff: '"Arial Narrow",Helvetica,sans-serif', w: 800, ls: -1, up: true },
  wide: { ff: 'Helvetica,Arial,sans-serif', w: 700, ls: 6, up: true },
  serif: { ff: 'Georgia,"Times New Roman",serif', w: 700, ls: 0, up: true },
  mono: { ff: '"Courier New",monospace', w: 700, ls: 1, up: true },
};

const xml = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function overlaySvg(o: string, fg: string, w: number, h: number): string {
  const c = fg;
  if (o === 'stripes') return Array.from({ length: 9 }, (_, i) => `<line x1="${w * 0.55 + i * 74}" y1="-20" x2="${w * 0.55 + 180 + i * 74}" y2="${h + 20}" stroke="${c}" stroke-width="2" opacity="0.05"/>`).join('');
  if (o === 'grain') return `<rect width="${w}" height="${h}" fill="url(#grain)" opacity="0.5"/>`;
  if (o === 'gradient') return `<rect width="${w}" height="${h}" fill="url(#grad)"/>`;
  if (o === 'spotlight') return `<ellipse cx="${w * 0.72}" cy="${h * 0.35}" rx="${w * 0.5}" ry="${h * 0.8}" fill="url(#spot)"/>`;
  return '';
}

export interface BannerData { name: string; nickname?: string; sport?: string | null; club?: string | null; city?: string | null }

// The themed banner (Layer 1 media substitute + Layer 3 data overlay). Used as
// the "no empty banners ever" default and as the OG image (og=true → 1200x630).
export function bannerSvg(d: BannerData, spec: ThemeSpec, opts: { og?: boolean; backdrop?: boolean } = {}): string {
  const t = autoContrast(spec);
  const w = 1200, h = opts.og ? 630 : 420;
  const ty = TYPE_CSS[t.type] ?? TYPE_CSS.bold;
  const title = (d.name || 'Horda');
  const disp = ty.up ? title.toUpperCase() : title;
  const size = disp.length <= 8 ? 132 : disp.length <= 14 ? 104 : disp.length <= 22 ? 78 : 58;
  const cy = opts.og ? h * 0.52 : 232;
  const subline = [d.sport ? d.sport.replace(/_/g, ' ') : '', d.club || '', d.city || ''].filter(Boolean).join('  ·  ');
  const scrim = `<rect x="0" y="${h - 150}" width="${w}" height="150" fill="url(#scrim)"/>`;
  const defs = `<defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.28"/><stop offset="0.7" stop-color="${t.bg}" stop-opacity="0"/></linearGradient>
    <radialGradient id="spot"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bg}" stop-opacity="0"/><stop offset="1" stop-color="${t.bg}" stop-opacity="0.55"/></linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect id="grainR"/>
  </defs>`;
  const nick = d.nickname ? `<text x="72" y="${cy - size * 0.86}" font-family="${ty.ff}" font-weight="700" font-size="30" letter-spacing="4" fill="${t.accent}">“${xml(d.nickname.toUpperCase())}”</text>` : '';
  // Backdrop mode: just the themed look (colors + texture + accent + mark), no
  // name/subline — used behind portrait cards where the name is shown separately.
  const dataLayer = opts.backdrop ? `<rect x="0" y="${h - 10}" width="${w}" height="10" fill="${t.accent}"/>` : `
    ${nick}
    <text x="72" y="${cy}" font-family="${ty.ff}" font-weight="${ty.w}" font-size="${size}" letter-spacing="${ty.ls}" fill="${t.fg}">${xml(disp)}</text>
    <rect x="74" y="${cy + 26}" width="220" height="8" fill="${t.accent}"/>
    ${subline ? `<text x="74" y="${cy + 78}" font-family="Helvetica,Arial,sans-serif" font-weight="600" font-size="27" fill="${t.fg}" opacity="0.82">${xml(subline)}</text>` : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${defs}
    <rect width="${w}" height="${h}" fill="${t.bg}"/>
    ${overlaySvg(t.overlay, t.fg, w, h)}
    ${scrim}
    ${dataLayer}
    <g transform="translate(${w - 176},${h - (opts.og ? 150 : 128)})" opacity="0.92">${ravenMark(120, lum(t.bg) < 0.5 ? 'bone' : 'ink')}</g>
  </svg>`;
}

export const svgDataUri = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

// --- theme studio (Standard mode, §4a) --------------------------------------
// Preset chips auto-previewed with the athlete's own name, an accent picker, a
// type style, and a "sample colors from a photo" tool (palette-from-media).
export function renderThemeStudio(athleteId: string, name: string, current: ThemeSpec): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  const preview = (spec: ThemeSpec) => `<span class="thpv">${bannerSvg({ name }, spec)}</span>`;
  const chips = THEME_PRESETS.map(p => {
    const on = p.spec.bg.toLowerCase() === current.bg.toLowerCase() && p.spec.accent.toLowerCase() === current.accent.toLowerCase();
    return `<label class="thchip"><input type="radio" name="preset" value="${p.id}"${on ? ' checked' : ''}>${preview(p.spec)}<span class="thname">${xml(p.name)}</span></label>`;
  }).join('');
  const typeOpt = (['bold', 'condensed', 'wide', 'serif', 'mono'] as const).map(t => `<option value="${t}"${current.type === t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('');
  const ovOpt = (['none', 'gradient', 'grain', 'stripes', 'spotlight'] as const).map(o => `<option value="${o}"${current.overlay === o ? ' selected' : ''}>${o[0].toUpperCase() + o.slice(1)}</option>`).join('');
  return `
    <style>
      .thchips{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0}
      .thchip{display:block;border:1.5px solid var(--b);border-radius:12px;overflow:hidden;cursor:pointer;position:relative;background:var(--s)}
      .thchip input{position:absolute;opacity:0}
      .thchip:has(input:checked){border-color:var(--bone);box-shadow:0 0 0 2px var(--bone)}
      .thpv{display:block;aspect-ratio:1200/420;overflow:hidden}.thpv svg{width:100%;height:auto;display:block}
      .thname{display:block;font-size:11px;padding:4px 8px;color:var(--mut)}
      .throw{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}.throw label{flex:1;min-width:120px;font-size:13px;color:var(--mut)}
      .thpvbig{aspect-ratio:1200/420;border-radius:12px;overflow:hidden;border:1px solid var(--b);margin:6px 0}.thpvbig svg{width:100%;height:auto;display:block}
    </style>
    <form method="post" action="/athlete/${xml(athleteId)}/theme">
      <div class="thpvbig" id="thbig">${bannerSvg({ name }, current)}</div>
      <div class="thchips">${chips}</div>
      <div class="throw">
        <label>Accent<input id="thaccent" type="color" name="accent" value="${xml(current.accent)}" style="${inp};height:42px;padding:4px"></label>
        <label>Type<select name="type" style="${inp}">${typeOpt}</select></label>
        <label>Texture<select name="overlay" style="${inp}">${ovOpt}</select></label>
      </div>
      <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Sample colors from a photo<input id="thsample" type="file" accept="image/*" style="margin-top:6px;color:inherit"></label>
      <input type="hidden" name="bg" id="thbg" value="${xml(current.bg)}">
      <div class="row" style="margin-top:10px"><button type="submit">Save theme</button></div>
    </form>
    <script>(function(){var s=document.getElementById('thsample');if(!s)return;s.addEventListener('change',function(){var f=s.files[0];if(!f)return;var img=new Image();img.onload=function(){var c=document.createElement('canvas');c.width=24;c.height=24;var x=c.getContext('2d');x.drawImage(img,0,0,24,24);var d=x.getData?[]:x.getImageData(0,0,24,24).data;var r=0,g=0,b=0,n=0,dr=0,dg=0,db=0,best=0;for(var i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;var sat=Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);if(sat>best){best=sat;dr=d[i];dg=d[i+1];db=d[i+2];}}r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);function hx(v){return('0'+v.toString(16)).slice(-2);}var bg='#'+hx(Math.round(r*0.35))+hx(Math.round(g*0.35))+hx(Math.round(b*0.35));var ac='#'+hx(dr)+hx(dg)+hx(db);document.getElementById('thbg').value=bg;document.getElementById('thaccent').value=ac;};img.src=URL.createObjectURL(f);});})();</script>`;
}

// --- pluggable social source (§4/§6 architecture requirement) ---------------
// Native Horda media later becomes just another source. Real IG Graph / TikTok
// Display pulls drop in behind consented OAuth + app approval; until then this
// returns nothing and the themed default carries the wow.
export interface SocialMedia { url: string; kind: 'image' | 'video'; permalink?: string }
export interface SocialSource { platform: string; fetchRecentMedia(handle: string): Promise<SocialMedia[]> }
export function getSocialSource(_platform: string): SocialSource | null {
  // No approved API credentials wired yet — see §11.5 (consented APIs only, no scraping).
  return null;
}

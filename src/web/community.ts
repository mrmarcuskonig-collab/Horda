// community.ts — the Discord surface, in one place.
//
// Everything here is ENV-GATED on DISCORD_INVITE_URL. If that env var is not
// set, every helper returns '' and no Discord link renders anywhere. That means
// the code can ship to production before the server exists, and a dead invite
// can be killed instantly by unsetting one variable in Render — no deploy.
//
// Why Discord is deliberately NOT in the left rail: the rail is the product
// loop (Explore → Following → Create). Putting "leave the site" next to
// "create an event" on every page trades a conversion for a Discord join.
// Discord belongs where people are already deciding whether to trust us:
// the footer, /about, the changelog, and the moment just after signing up.

// The live invite. Overridable via DISCORD_INVITE_URL without a deploy — which
// matters, because Discord invites can be revoked or replaced and a dead invite
// on a marketing page is a trust bug.
//
// NOTE: this must be a real INVITE (discord.gg/xxxx). A channel URL
// (discord.com/channels/<server>/<channel>) only resolves for people already in
// the server — everyone else sees "no text channels". hasDiscord() rejects
// channel URLs outright so that mistake can never ship.
const DEFAULT_INVITE = 'https://discord.gg/VQZKZmbt';

/** The Discord URL we send people to, or '' if nothing usable is configured. */
export function discordUrl(): string {
  const raw = (process.env.DISCORD_INVITE_URL ?? DEFAULT_INVITE).trim();
  if (!raw) return '';
  // Prefer a real invite (discord.gg/xxxx) — it works for everyone. A channel
  // deep link (discord.com/channels/…) only resolves for existing members, so if
  // that's all that's set we fall back to the default invite rather than shipping
  // a link that silently fails for newcomers. (Set DISCORD_INVITE_URL to a proper
  // invite to point at a specific server.)
  if (/discord\.com\/channels\//i.test(raw)) return DEFAULT_INVITE || '';
  return raw;
}

export function hasDiscord(): boolean {
  return discordUrl().length > 0;
}

/**
 * The address we publish everywhere: joinhorda.com/discord → 302 → the invite.
 * Lovable does exactly this (lovable.dev/discord). One indirection means the
 * invite can be rotated in env without editing a single link, and any invite
 * we've ever printed, posted or put on a sticker keeps working.
 */
export const DISCORD_PATH = '/discord';

/** Discord's mark. Inline so it works with no network and inherits colour. */
export function discordMark(size = 16): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.35-1.22.645-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z"/></svg>`;
}

/** A plain footer link. '' when Discord isn't configured. */
export function discordFootLink(label = 'Discord'): string {
  return hasDiscord() ? `<a href="${DISCORD_PATH}">${discordMark(13)} ${label}</a>` : '';
}

/** A button, for CTAs. '' when unconfigured. */
export function discordBtn(label = 'Join our Discord', cls = 'btn ghost'): string {
  return hasDiscord() ? `<a class="${cls}" href="${DISCORD_PATH}">${discordMark(15)} ${label} ↗</a>` : '';
}

/**
 * The full "build this with us" module for /about and the changelog.
 * Leads with what the fan gets, not with "join our community".
 */
export function discordModule(): string {
  if (!hasDiscord()) return '';
  return `
  <div class="dsc">
    <div class="dsci">${discordMark(26)}</div>
    <div>
      <h3>Tell us what to build. Watch us build it.</h3>
      <p>Horda is built in the open. Ask for a feature in our Discord, argue with our decisions, see the thing appear on the <a href="/changelog">changelog</a> — with your name on it. The fastest way to change this product is to say something.</p>
      <a class="btn" href="${DISCORD_PATH}">${discordMark(15)} Join the Discord ↗</a>
    </div>
  </div>`;
}

/** CSS for the module. Included by pages that call discordModule(). */
export const DSC_CSS = `
  .dsc{display:flex;gap:18px;align-items:flex-start;border:1px solid var(--b);border-radius:18px;padding:24px;background:var(--s);margin-top:16px}
  .dsc .dsci{flex:0 0 auto;color:#5865F2;line-height:0;padding-top:2px}
  .dsc h3{font-size:20px;font-weight:800;letter-spacing:-.01em;margin:0 0 7px}
  .dsc p{color:var(--mut);font-size:14.5px;line-height:1.6;margin:0 0 14px;max-width:62ch}
  .dsc p a{color:var(--bone);border-bottom:1px solid var(--b)}
  @media(max-width:600px){.dsc{flex-direction:column;gap:12px}}`;

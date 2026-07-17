// raster.ts — SVG → PNG. The only reason this file exists is that no unfurler
// renders SVG.
//
// WHY A DEPENDENCY, IN A ZERO-DEPENDENCY APP
// ------------------------------------------
// Facebook, WhatsApp, iMessage, X and Slack all ignore an SVG og:image, and the
// Web Share sheet won't hand an SVG to Instagram. PNG is not a preference, it's
// the format the outside world accepts. Rasterising means a text layout engine +
// a font rasteriser; there is no honest way to write that here. @resvg/resvg-js
// ships prebuilt binaries for linux-x64-gnu (Render) and darwin-arm64 (dev).
//
// THE FAILURE MODE THIS FILE IS BUILT AROUND
// ------------------------------------------
// A native module that fails to load must NEVER take an event page down with it.
// The card is a nice-to-have on the page and a must-have in the chat, so:
//   - the import is lazy and cached, so a broken binary costs one attempt;
//   - every failure returns null and the caller falls back to the SVG/no image;
//   - the event page itself never awaits this.
//
// FONTS ARE THE QUIET FAILURE. resvg renders text with the fonts it can find. On
// a bare node:22-slim there are NONE — every card would come back a beautiful,
// perfectly-valid, completely EMPTY rectangle, and nothing would error. The
// Dockerfile installs fonts-liberation for this reason, and tests/card.test.ts
// asserts that two different titles produce different PNGs, which is the only
// cheap way to prove glyphs actually landed on the canvas.

type Renderer = { render: (svg: string) => Buffer | null };
let cached: Renderer | null | undefined;   // undefined = not tried, null = unavailable

async function loadRenderer(): Promise<Renderer | null> {
  if (cached !== undefined) return cached;
  cached = null;
  if (process.env.HORDA_RASTER === 'off') return cached;
  try {
    const mod: any = await import('@resvg/resvg-js');
    const Resvg = mod.Resvg ?? mod.default?.Resvg;
    if (!Resvg) return cached;
    cached = {
      render(svg: string) {
        const r = new Resvg(svg, {
          fitTo: { mode: 'width', value: 1200 },
          font: { loadSystemFonts: true, defaultFontFamily: 'Liberation Sans' },
          // A remote cover image is fetched by the caller and inlined as a data:
          // URI before we get here. resvg does no network I/O, and it must not:
          // rendering a card is on the request path for an unfurl, and an event
          // whose cover is hosted on a slow origin would hang the crawler.
        });
        return Buffer.from(r.render().asPng());
      },
    };
  } catch {
    cached = null;   // not installed / wrong platform / broken binary — card degrades, page lives
  }
  return cached;
}

/** SVG → PNG bytes, or null when rasterising isn't available. Never throws. */
export async function svgToPng(svg: string): Promise<Buffer | null> {
  try {
    const r = await loadRenderer();
    if (!r) return null;
    return r.render(svg);
  } catch {
    return null;
  }
}

export async function rasterAvailable(): Promise<boolean> {
  return (await loadRenderer()) !== null;
}

/**
 * Fetch a remote image and inline it as a data: URI so the rasteriser stays
 * offline. Bounded on purpose — a 30MB cover would be a memory bomb on a route
 * anyone can hit, and a hanging origin would hold the socket open.
 */
export async function inlineImage(url: string | null | undefined, ms = 2500): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

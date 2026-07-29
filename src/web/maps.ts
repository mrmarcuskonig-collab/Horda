// maps.ts — "Open in Maps" asks which maps.
//
// We used to hard-link Google Maps. On an iPhone — a large share of the people
// standing outside a venue trying to find the door — that means a browser tab,
// a "Open in the Google Maps app?" interstitial, or an App Store page if they
// don't have it installed. Guessing wrong here costs someone the first ten
// minutes of the event they paid for.
//
// SO WE ASK — ONCE. The choice is remembered per device, and the second tap goes
// straight through. A chooser that asks every single time is its own kind of
// disrespect.
//
// The platform hint only ORDERS the options, it never decides for you: plenty of
// iPhone users live in Google Maps, and the User-Agent is a guess.
const esc2 = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function googleMapsUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
// Apple's documented web endpoint. On iOS/macOS it hands off to the Maps app;
// everywhere else it renders a usable web map (a dead end on Android, which is
// exactly why the chooser exists rather than a redirect).
export function appleMapsUrl(q: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
}

export const MAPS_CSS = `
  .mapch{position:relative;display:inline-block}
  .mapch > summary{list-style:none;cursor:pointer}
  .mapch > summary::-webkit-details-marker{display:none}
  .mapmenu{position:absolute;z-index:30;left:0;top:calc(100% + 6px);min-width:186px;background:var(--ink);
    border:1px solid var(--b);border-radius:var(--btnr);padding:6px;box-shadow:0 12px 34px rgba(0,0,0,.5)}
  .mapmenu button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;border:0;
    color:var(--bone);font:inherit;font-size:13.5px;font-weight:600;padding:9px 10px;border-radius:9px;cursor:pointer}
  .mapmenu button:hover{background:var(--s)}
  .mapmenu .mapnote{color:var(--mut);font-size:11px;padding:4px 10px 2px;line-height:1.4}
  .mapmenu .mapre{color:var(--mut);font-size:11px;padding:6px 10px 2px;border-top:1px solid var(--b);margin-top:4px}
  .mapmenu .mapre button{display:inline;padding:0;font-size:11px;font-weight:600;color:var(--mut);text-decoration:underline;width:auto}`;

/**
 * A chooser button. `cls` styles the trigger so this drops into any row.
 *
 * Uses <details> for the popover so it opens, closes on Escape and traps focus
 * without a line of framework — and still works if the script never runs, in
 * which case both options are simply visible as links.
 */
export function mapsChooser(o: { query: string; label?: string; cls?: string }): string {
  const q = esc2(o.query);
  const g = esc2(googleMapsUrl(o.query));
  const a = esc2(appleMapsUrl(o.query));
  const label = esc2(o.label || 'Open in Maps');
  const gIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 21c4-4.5 6-7.9 6-10.7a6 6 0 1 0-12 0C6 13.1 8 16.5 12 21Z"/><circle cx="12" cy="10.3" r="2.2"/></svg>`;
  const aIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M16.4 12.8c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-1.9.8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.2zM14.5 6.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z"/></svg>`;

  // The destination URLs ride on data-attributes and the click is wired in
  // MAPS_SCRIPT — NOT an inline onclick. An inline handler would embed the
  // double-quoted URL inside a double-quoted attribute and silently break the
  // whole button. localStorage keeps the per-device preference; no server round-trip.
  return `<details class="mapch">
    <summary class="${esc2(o.cls || 'rb')}" role="button">${label} ↗</summary>
    <div class="mapmenu">
      <div class="mapnote">${q ? 'Take me to it in…' : 'Open in…'}</div>
      <button type="button" data-maps="google" data-url="${g}">${gIcon} Google Maps</button>
      <button type="button" data-maps="apple" data-url="${a}">${aIcon} Apple Maps</button>
      <noscript><a href="${g}" target="_blank" rel="noopener">Google Maps</a> · <a href="${a}" target="_blank" rel="noopener">Apple Maps</a></noscript>
    </div>
  </details>`;
}

/**
 * Remembers the answer. After the first choice the trigger becomes a direct link
 * to that app, and offers a quiet way back to the chooser — asked once, not
 * every time, and never locked in.
 *
 * Ordering by platform is a hint only: an iPhone in someone's hand is not
 * evidence they use Apple Maps.
 */
export const MAPS_SCRIPT = `<script>(function(){
  var K='hz_maps';
  var pref=null; try{ pref=localStorage.getItem(K); }catch(e){}
  var isApple=/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent||'');
  function openIn(which,url){
    try{ localStorage.setItem(K, which); }catch(e){}
    var w=window.open(url,'_blank'); if(w){ try{ w.opener=null; }catch(e){} }
    else { location.href=url; }   // popup blocked → navigate this tab instead
  }
  [].forEach.call(document.querySelectorAll('.mapch'),function(d){
    var menu=d.querySelector('.mapmenu');
    var g=menu.querySelector('[data-maps="google"]'), a=menu.querySelector('[data-maps="apple"]');
    // Each option opens its own map. The URL rides on data-url (no inline onclick).
    [].forEach.call(menu.querySelectorAll('button[data-maps]'),function(b){
      b.addEventListener('click',function(ev){
        ev.preventDefault();
        openIn(b.getAttribute('data-maps'), b.getAttribute('data-url'));
        d.open=false;
      });
    });
    // Put the likely one first. The other stays one glance away.
    if(isApple && a && g) menu.insertBefore(a,g);
    if(pref==='google'||pref==='apple'){
      var go=menu.querySelector('[data-maps="'+pref+'"]');
      // Preference known: the summary itself opens it — no menu, no second tap.
      d.querySelector('summary').addEventListener('click',function(e){
        if(d.open) return;                 // already open (they came back to switch)
        e.preventDefault(); go.click();
      });
      if(!menu.querySelector('.mapre')){
        var re=document.createElement('div'); re.className='mapre';
        re.innerHTML='Opens in '+(pref==='apple'?'Apple':'Google')+' Maps. <button type="button">Use the other one</button>';
        re.querySelector('button').addEventListener('click',function(){ try{localStorage.removeItem(K);}catch(e){} d.open=false; location.reload(); });
        menu.appendChild(re);
      }
    }
  });
  // Click-away close — a popover that can only be dismissed by its own trigger
  // is a trap on touch.
  document.addEventListener('click',function(e){
    [].forEach.call(document.querySelectorAll('.mapch[open]'),function(d){ if(!d.contains(e.target)) d.open=false; });
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape')[].forEach.call(document.querySelectorAll('.mapch[open]'),function(d){d.open=false}); });
})();</script>`;

// peek.ts — mobile "peek sheet" for events. On a phone, tapping an event card
// slides a half-height sheet OVER the current screen (showing the most important
// info: poster, when/where, claim CTA). You can expand it to full, collapse it,
// or dismiss it — without losing the list you were on. Desktop and no-JS clients
// navigate normally (progressive enhancement: the <a> still works).
//
// It fetches the real event page and lifts its content (.poster + .evgrid) into
// the sheet, so there's ONE source of truth for what an event looks like. If the
// fetch or parse fails, it falls back to a normal navigation — never a dead tap.

export const PEEK_CSS = `
  /* The sheet only exists on mobile; desktop keeps normal navigation. */
  #hz-peek, #hz-peekscrim { display: none; }
  @media (max-width: 820px) {
    #hz-peekscrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); opacity: 0; transition: opacity .2s ease; z-index: 60; }
    #hz-peekscrim.on { display: block; opacity: 1; }
    #hz-peek {
      display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 61;
      height: 92vh; background: var(--ink, #232020); border-top-left-radius: 18px; border-top-right-radius: 18px;
      box-shadow: 0 -12px 40px rgba(0,0,0,.5); transform: translateY(102%);
      transition: transform .28s cubic-bezier(.22,.61,.36,1); display: flex; flex-direction: column;
    }
    /* peek = ~58% up; open = full. A single class flips between them. */
    #hz-peek.peek { transform: translateY(42vh); }
    #hz-peek.open { transform: translateY(0); }
    #hz-peek .hz-pkhead { flex: 0 0 auto; padding: 8px 14px 6px; position: relative; }
    #hz-peek .hz-pkgrip { width: 40px; height: 4px; border-radius: 999px; background: var(--b, #3a3532); margin: 4px auto 8px; }
    #hz-peek .hz-pkbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    #hz-peek .hz-pkfull { color: var(--mut, #a49e97); font-size: 12.5px; border-bottom: 1px solid var(--b,#3a3532); }
    #hz-peek .hz-pkx { background: none; border: 0; color: var(--mut,#a49e97); font-size: 22px; line-height: 1; padding: 2px 6px; cursor: pointer; }
    #hz-peek .hz-pkbody { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 2px 40px; }
    /* the lifted event content sits full-bleed inside the sheet */
    #hz-peek .hz-pkbody .poster { border-radius: 0; }
    #hz-peek .hz-pkloading { padding: 40px 16px; text-align: center; color: var(--mut,#a49e97); font-size: 14px; }
    body.hz-peek-open { overflow: hidden; }
  }
`;

export const PEEK_SCRIPT = `<script>(function(){
  if(!window.matchMedia||!window.matchMedia('(max-width: 820px)').matches) return;
  var mount=function(){
    if(document.getElementById('hz-peek')) return;
    var scrim=document.createElement('div'); scrim.id='hz-peekscrim';
    var sheet=document.createElement('div'); sheet.id='hz-peek';
    sheet.innerHTML='<div class="hz-pkhead"><div class="hz-pkgrip"></div><div class="hz-pkbar"><a class="hz-pkfull" href="#">Open full page \\u2197</a><button class="hz-pkx" aria-label="Close">\\u00d7</button></div></div><div class="hz-pkbody"><div class="hz-pkloading">Loading\\u2026</div></div>';
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    var body=sheet.querySelector('.hz-pkbody'), full=sheet.querySelector('.hz-pkfull'), x=sheet.querySelector('.hz-pkx'), grip=sheet.querySelector('.hz-pkgrip');
    var current='';
    function close(){ sheet.classList.remove('open','peek'); scrim.classList.remove('on'); document.body.classList.remove('hz-peek-open'); setTimeout(function(){ body.innerHTML='<div class=\\'hz-pkloading\\'>Loading\\u2026</div>'; },280); }
    function openTo(cls){ sheet.classList.remove('peek','open'); sheet.classList.add(cls); scrim.classList.add('on'); document.body.classList.add('hz-peek-open'); }
    scrim.addEventListener('click',close); x.addEventListener('click',close);
    grip.addEventListener('click',function(){ sheet.classList.toggle('open'); sheet.classList.toggle('peek'); });
    full.addEventListener('click',function(e){ e.preventDefault(); if(current) location.href=current; });
    // Back button closes the sheet instead of leaving the page.
    window.addEventListener('popstate',function(){ if(scrim.classList.contains('on')) close(); });
    // Simple swipe: drag down on the header closes; drag up expands.
    var sy=0; sheet.querySelector('.hz-pkhead').addEventListener('touchstart',function(e){ sy=e.touches[0].clientY; },{passive:true});
    sheet.querySelector('.hz-pkhead').addEventListener('touchend',function(e){ var dy=e.changedTouches[0].clientY-sy; if(dy>60) close(); else if(dy<-40) openTo('open'); },{passive:true});
    window.__hzPeekOpen=function(href){
      current=href; openTo('peek');
      try{ history.pushState({hzpeek:1},'',href); }catch(_){}
      fetch(href,{headers:{'x-hz-peek':'1'}}).then(function(r){return r.text();}).then(function(html){
        var doc=new DOMParser().parseFromString(html,'text/html');
        var poster=doc.querySelector('.poster'), grid=doc.querySelector('.evgrid');
        if(!poster&&!grid){ location.href=href; return; }
        body.innerHTML=(poster?poster.outerHTML:'')+(grid?grid.outerHTML:'');
        body.scrollTop=0;
      }).catch(function(){ location.href=href; });
    };
  };
  mount();
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    var a=e.target.closest&&e.target.closest('a[href^="/e/"]');
    if(!a) return;
    if(a.closest('#hz-peek')) return;               // links inside the sheet navigate normally
    var href=a.getAttribute('href')||'';
    if(!/^\\/e\\/[0-9a-f-]+(\\?|$)/i.test(href)) return;  // only event pages, not /e/:id/room etc.
    if(/\\/(room|check-in|manage|card\\.png|ics)/.test(href)) return;
    e.preventDefault();
    if(window.__hzPeekOpen) window.__hzPeekOpen(href); else location.href=href;
  });
})();</script>`;

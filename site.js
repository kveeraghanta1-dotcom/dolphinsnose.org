(function(){
  var me = document.currentScript || document.querySelector('script[src*="site.js"]');
  var BASE = me ? me.src.replace(/site\.js(\?.*)?$/, '') : '/';
  var BOOKS = window.KV_BOOKS || {}, IDX = window.KV_INDEX || [];

  function norm(s){ return (s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[–—‐-]/g,' '); }
  function esc(s){ return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function hi(text, toks){
    var out = esc(text);
    toks.forEach(function(t){ if(t.length<2) return;
      var re = new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
      out = out.replace(re,'<mark>$1</mark>'); });
    return out;
  }
  function search(q){
    var toks = norm(q).split(/\s+/).filter(Boolean);
    if(!toks.length) return {toks:toks, groups:[]};
    var by = {};
    IDX.forEach(function(e){
      var b = BOOKS[e.b]; var hay = norm(e.t+' '+(e.c||'')+(e.k==='book'?' '+b.s+' '+b.d+' '+b.kw:''));
      for(var i=0;i<toks.length;i++){ if(hay.indexOf(toks[i])<0) return; }
      var score = (e.k==='book'?50:e.k==='part'?20:e.k==='chapter'?12:5);
      if(norm(e.t).indexOf(toks.join(' '))>=0) score += 15;
      (by[e.b] = by[e.b] || {b:e.b, score:0, items:[]});
      by[e.b].score += score; if(e.k!=='book') by[e.b].items.push({e:e,s:score}); else by[e.b].bookHit=true;
    });
    var groups = Object.keys(by).map(function(k){ var g=by[k]; g.items.sort(function(a,b){return b.s-a.s||a.e.p-b.e.p;}); return g; })
      .sort(function(a,b){ return b.score-a.score; });
    return {toks:toks, groups:groups};
  }
  function render(q, el, limit){
    if(!q.trim()){ el.innerHTML='<div class="sr-hint">Search titles, chapters and sections across all '+Object.keys(BOOKS).length+' books.</div>'; return; }
    var r = search(q), html='', n=0;
    r.groups.forEach(function(g){
      var b = BOOKS[g.b], url = BASE+'books/'+g.b+'.html';
      html += '<div class="sr-group"><a class="sr-book" href="'+url+'"><img src="'+BASE+'img/'+g.b+'-thumb.jpg" alt="">'+hi(b.t,r.toks)+'</a>';
      g.items.slice(0, limit||8).forEach(function(it){ var e=it.e; n++;
        html += '<a class="sr-item" href="'+url+(e.a?'#'+e.a:'#contents')+'" data-q="'+esc(q)+'"><span>'+hi(e.t,r.toks)+
          (e.c?'<small>in '+esc(e.c)+'</small>':'<small>'+(e.k==='part'?'Part':'Chapter')+'</small>')+'</span><span class="pg">p. '+e.p+'</span></a>';
      });
      if(g.items.length>(limit||8)) html += '<a class="sr-item" href="'+url+'#contents"><span><small>+ '+(g.items.length-(limit||8))+' more in this book</small></span></a>';
      html += '</div>';
    });
    el.innerHTML = html || '<div class="sr-none">No matches for “'+esc(q)+'”. Try a broader word.</div>';
  }

  // overlay
  var ov = document.getElementById('searchOv'), inp = document.getElementById('searchQ'), res = document.getElementById('searchRes');
  function open(){ if(!ov) return; ov.hidden=false; inp.value=''; render('',res); inp.focus(); }
  function close(){ if(ov) ov.hidden=true; }
  document.querySelectorAll('[data-open-search]').forEach(function(b){ b.addEventListener('click', open); });
  document.querySelectorAll('[data-close-search]').forEach(function(b){ b.addEventListener('click', close); });
  if(ov){ ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
    inp.addEventListener('input', function(){ render(inp.value,res); });
    inp.addEventListener('keydown', function(e){
      var items=[].slice.call(res.querySelectorAll('.sr-item,.sr-book')), i=items.findIndex(function(x){return x.classList.contains('on');});
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(i>=0) items[i].classList.remove('on');
        i = e.key==='ArrowDown'? Math.min(items.length-1,i+1) : Math.max(0,i-1); if(items[i]){items[i].classList.add('on');items[i].scrollIntoView({block:'nearest'});} }
      if(e.key==='Enter'){ var t = items[i>=0?i:0]; if(t) location.href=t.href; }
    });
    res.addEventListener('click', function(e){ var a=e.target.closest('a'); if(a && a.hash && a.pathname===location.pathname){ close(); } });
  }
  document.addEventListener('keydown', function(e){
    var tag=(document.activeElement||{}).tagName;
    if(e.key==='/' && tag!=='INPUT' && tag!=='TEXTAREA'){ e.preventDefault(); open(); }
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); open(); }
    if(e.key==='Escape') close();
  });

  // search page
  var pq = document.getElementById('pageQ'), pr = document.getElementById('pageRes');
  if(pq && pr){ var q0 = new URLSearchParams(location.search).get('q')||''; pq.value=q0; render(q0,pr,50);
    pq.addEventListener('input', function(){ render(pq.value,pr,50); history.replaceState(null,'','?q='+encodeURIComponent(pq.value)); }); }

  // copy buttons
  document.querySelectorAll('[data-copy]').forEach(function(b){ b.addEventListener('click', function(){
    var t=b.getAttribute('data-copy'), old=b.textContent;
    (navigator.clipboard? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){b.textContent='Copied';},function(){b.textContent='Select the address to copy';});
    setTimeout(function(){b.textContent=old;},2200); }); });

  // TOC filter + deep links
  var tf = document.getElementById('tocFilter'), toc = document.getElementById('toc');
  function filterToc(q){
    var toks = norm(q).split(/\s+/).filter(Boolean), any=false;
    toc.querySelectorAll('.ch').forEach(function(ch){
      var title = norm((ch.querySelector('.ct')||ch).textContent), lis = ch.querySelectorAll('.secs li'), chHit=false, secHit=false;
      ch.classList.remove('hit'); lis.forEach(function(li){li.classList.remove('hit');});
      if(!toks.length){ ch.hidden=false; if(ch.tagName==='DETAILS') ch.open=false; return; }
      chHit = toks.every(function(t){return title.indexOf(t)>=0;});
      lis.forEach(function(li){ var h = toks.every(function(t){return norm(li.textContent).indexOf(t)>=0;}); if(h){li.classList.add('hit'); secHit=true;} });
      ch.hidden = !(chHit||secHit); if(chHit) ch.classList.add('hit'); if(ch.tagName==='DETAILS') ch.open = secHit; if(chHit||secHit) any=true;
    });
    toc.querySelectorAll('.part').forEach(function(p){ p.hidden = !!toks.length; });
    document.getElementById('tocEmpty').hidden = !toks.length || any;
  }
  if(tf && toc){ tf.addEventListener('input', function(){ filterToc(tf.value); });
    function openHash(){ var el = location.hash && document.getElementById(location.hash.slice(1)); if(el && el.tagName==='DETAILS'){ el.open=true; el.classList.add('hit'); setTimeout(function(){el.scrollIntoView({block:'center'});},50);} }
    window.addEventListener('hashchange', openHash); openHash(); }

  // hero search: go to search page
  document.querySelectorAll('[data-hero-search]').forEach(function(f){ f.addEventListener('submit', function(e){
    e.preventDefault(); var q=f.querySelector('input').value; location.href = BASE+'search.html?q='+encodeURIComponent(q); }); });
})();

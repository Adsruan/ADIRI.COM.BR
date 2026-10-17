/* Own/licensed chord charts only. No external content fetching. */
(function(root){
'use strict';
const mod=n=>((n%12)+12)%12;
const SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NAT={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const clean=s=>String(s||'').replace(/♯/g,'#').replace(/♭/g,'b');
const CHORD=/^([A-G])([#b]{0,2})((?:(?:maj|min|dim|aug|sus|add|omit|alt|no)|[mMΔø°º+−\-\d#b(),/])*)(?:\/([A-G])([#b]{0,2}))?$/;
function pitch(note){const m=clean(note).match(/^([A-G])([#b]{0,2})$/);return m?mod(NAT[m[1]]+[...m[2]].reduce((n,a)=>n+(a==='#'?1:-1),0)):null;}
function keyInfo(key){const m=clean(key).trim().match(/^([A-G][#b]{0,2})(m|min)?$/);return m?{pitch:pitch(m[1]),minor:!!m[2],flat:m[1].includes('b')||['F','Dm','Gm','Cm','Fm'].includes(m[1]+(m[2]?'m':''))}:null;}
function transposeKey(key,steps){const k=keyInfo(key);if(!k)return null;const p=mod(k.pitch+steps);return (k.flat?FLAT:SHARP)[p]+(k.minor?'m':'');}
function transposeChord(chord,steps,flats=false){const m=clean(chord).match(CHORD);if(!m)return chord;if(mod(steps)===0)return chord;const names=flats?FLAT:SHARP;return names[mod(pitch(m[1]+m[2])+steps)]+m[3]+(m[4]?'/'+names[mod(pitch(m[4]+m[5])+steps)]:'');}
const isChord=s=>CHORD.test(clean(s));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function chordLine(line){const tokens=[...line.matchAll(/\S+/g)];return tokens.length>0&&tokens.some(t=>isChord(t[0]))&&tokens.every(t=>isChord(t[0])||/^(?:[|:/.%\-]+|\(?\d+x\)?|\[\d+x\]|x\d+|\(?(?:bis|repete)\)?|(?:Intro|Solo|Refrão|Ponte|Final):|\[(?:Intro|Solo|Refrão|Ponte|Final)\]|N\.C\.)$/i.test(t[0]));}
function unit(chord,lyric,steps,flats){return '<span class="chart-unit"><b class="chart-chord">'+esc(chord?transposeChord(chord,steps,flats):'\u00a0')+'</b><span class="chart-lyric">'+esc(lyric||'\u00a0')+'</span></span>';}
function inlineLine(line,steps,flats){const matches=[...line.matchAll(/\[([^\]\n]+)\]/g)].filter(m=>isChord(m[1]));if(!matches.length)return null;let html=matches[0].index?unit('',line.slice(0,matches[0].index),steps,flats):'';matches.forEach((m,i)=>{const end=matches[i+1]?.index??line.length;html+=unit(m[1],line.slice(m.index+m[0].length,end),steps,flats)});return '<div class="chart-line">'+html+'</div>';}
function renderFlowChart(content,steps=0,flats=false){const lines=String(content).replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n');const out=[];for(let i=0;i<lines.length;i++){const line=lines[i];const inline=inlineLine(line,steps,flats);if(inline){out.push(inline);continue}if(chordLine(line)){const next=lines[i+1];const paired=next!==undefined&&next.trim()&&!chordLine(next)&&!inlineLine(next,0,false)&&!/^\s*\[.*\]\s*$/.test(next);const lyric=paired?next:'';const tokens=[...line.matchAll(/\S+/g)];let html=tokens[0].index?unit('',lyric.slice(0,tokens[0].index).padEnd(tokens[0].index),steps,flats):'';tokens.forEach((m,j)=>{const end=tokens[j+1]?.index??Math.max(line.length,lyric.length);html+=unit(m[0],lyric.slice(m.index,end).padEnd(end-m.index),steps,flats)});out.push('<div class="chart-line">'+html+'</div>');if(paired)i++;}else out.push('<div class="chart-text">'+(esc(line)||'&nbsp;')+'</div>');}return out.join('');}
// Traditional charts keep their original rows, spaces and tab stops. ChordPro
// remains supported for charts already stored in that explicit inline notation.
function visualColumns(text){let col=0;for(const c of text)col=c==='\t'?col+4-col%4:col+1;return col;}
function keyChoices(original){const k=keyInfo(original);if(!k)return [];const names=k.minor?['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B']:['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];return names.map((name,i)=>({key:i===k.pitch?original:name+(k.minor?'m':''),pitch:i,original:i===k.pitch}));}
function isInlineChart(content){return [...String(content).matchAll(/\[([^\]\n]+)\]/g)].some(m=>isChord(m[1]));}
function renderPlainChart(content,steps=0,flats=false){
 const lines=String(content).split('\n');return '<pre class="chart-faithful">'+lines.map(line=>{
  if(!chordLine(line))return esc(line);
  const tokens=[...line.matchAll(/\S+/g)];let out=esc(line.slice(0,tokens[0].index));
  tokens.forEach((m,i)=>{const end=tokens[i+1]?.index??line.length;const gap=line.slice(m.index+m[0].length,end);const chord=transposeChord(m[0],steps,flats);
   if(mod(steps)===0){out+='<b class="chart-chord">'+esc(m[0])+'</b>'+esc(gap);return;}
   // Reserve the exact original column of every following chord. If a very
   // tightly spaced chord grows, shrink only its label instead of moving lyrics.
   const start=visualColumns(line.slice(0,m.index));const width=tokens[i+1]?visualColumns(line.slice(0,end))-start:Math.max(visualColumns(line.slice(m.index)),chord.length);
   const scale=Math.min(1,width/Math.max(1,chord.length));
   out+='<span class="chart-slot" style="width:'+width+'ch"><b class="chart-chord" style="font-size:'+scale+'em">'+esc(chord)+'</b></span>';
  });return out;
 }).join('\n')+'</pre>';
}
function renderChart(content,steps=0,flats=false){return isInlineChart(content)?renderFlowChart(content,steps,flats):renderPlainChart(content,steps,flats);}
function nextScroll(position,max,speed,elapsed){return Math.min(max,position+speed*Math.min(Math.max(elapsed,0),100)/1000);}
class AutoScroller{
 constructor(view,{raf=cb=>requestAnimationFrame(cb),caf=id=>cancelAnimationFrame(id),onStop=()=>{}}={}){this.view=view;this.raf=raf;this.caf=caf;this.onStop=onStop;this.running=false;this.speed=24;this.id=null;this.last=null;this.position=0;}
 start(){if(this.running)return;const max=this.view.scrollHeight-this.view.clientHeight;if(max<=0||this.view.scrollTop>=max-1){this.view.scrollTop=Math.max(0,max);this.onStop();return}this.running=true;this.last=null;this.position=this.view.scrollTop;this.id=this.raf(t=>this.tick(t));}
 tick(t){if(!this.running)return;const max=Math.max(0,this.view.scrollHeight-this.view.clientHeight);if(this.last!==null)this.position=nextScroll(this.position,max,this.speed,t-this.last);this.last=t;this.view.scrollTop=this.position;if(this.position>=max-1){this.stop();return}this.id=this.raf(t=>this.tick(t));}
 stop(){this.running=false;if(this.id!==null)this.caf(this.id);this.id=null;this.last=null;this.onStop();}
}
class ChartStore{
 constructor(db,timestamp){this.db=db;this.timestamp=timestamp;}
 async read(songId){const snap=await this.db.collection('charts').doc(songId).get({source:'server'});return snap.exists?snap.data():null;}
 async save(songId,content,originalKey,baseline){if(!content.trim()||content.length>60000)throw new Error('Informe uma cifra com até 60.000 caracteres.');if(!keyInfo(originalKey))throw new Error('Informe um tom como C, F#, Bb ou Am.');const ref=this.db.collection('charts').doc(songId);let result;await this.db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.exists?snap.data():null;if((old?.revision||0)!==(baseline?.revision||0))throw new Error('A cifra mudou em outro dispositivo. Reabra o leitor antes de salvar.');result={song_id:songId,content,original_key:originalKey,revision:(old?.revision||0)+1,created_at:old?.created_at||this.timestamp(),updated_at:this.timestamp()};tx.set(ref,result)});return result;}
}
const core={pitch,keyInfo,transposeKey,transposeChord,isChord,renderChart,renderPlainChart,visualColumns,keyChoices,nextScroll,AutoScroller,ChartStore};
if(typeof module==='object'&&module.exports){module.exports=core;return;}
let api,current=null,epoch=0,overlay,scroll,scroller,returnFocus,background=[],wake=null,saving=false,dirty=false;
const $=id=>document.getElementById(id);
const say=text=>{$('chart-message').textContent=text;};
function create(){if(overlay)return;overlay=document.createElement('section');overlay.id='chart-reader';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','chart-title');overlay.innerHTML=`<header class="chart-header"><div><small>LOUVOR CENTRAL · CIFRA</small><h2 id="chart-title"></h2><p id="chart-artist"></p></div><div class="chart-top-actions"><a id="chart-external" target="_blank" rel="noopener noreferrer" hidden>Link externo ↗</a><button type="button" id="chart-edit">Editar cifra própria</button><button type="button" id="chart-layout">Leitura fluida</button><button type="button" id="chart-fullscreen">Tela cheia</button><button type="button" id="chart-close" aria-label="Fechar cifra">×</button></div></header><div id="chart-message" role="status" aria-live="polite"></div><p id="chart-provenance"></p><p id="chart-fit-hint" hidden>Para ampliar sem mudar as posições, gire o celular. Você também pode escolher Leitura fluida.</p><div id="chart-scroll" tabindex="0" aria-label="Área da cifra"><article id="chart-sheet"></article><form id="chart-editor" hidden><h3>Cifra própria</h3><p>Cole apenas conteúdo próprio ou autorizado. O link do Cifra Club fica como referência externa; não há importação automática.</p><label for="chart-original-key">Tom original desta cifra</label><input id="chart-original-key" maxlength="24" placeholder="C, F#, Bb, Am…" required><label for="chart-content">Letra e acordes</label><textarea id="chart-content" maxlength="60000" rows="16" spellcheck="false" autocapitalize="off" wrap="off" required placeholder="C           G/B&#10;Minha letra aqui&#10;&#10;Ou: [C]Minha letra [G/B]aqui"></textarea><p class="chart-help">Cole a cifra completa com os acordes acima da letra. O texto será salvo sem aparar espaços nem reorganizar linhas. Cifras já cadastradas no formato [C]palavra também continuam disponíveis.</p><div class="chart-editor-actions"><button type="submit" id="chart-save">Salvar cifra</button><button type="button" id="chart-cancel">Cancelar edição</button></div></form></div><footer class="chart-controls"><section id="chart-tones-panel" aria-label="12 tons calculados pelo aplicativo" hidden><p>Transposições calculadas pelo aplicativo · mesma progressão harmônica</p><div id="chart-tones"></div></section><div class="chart-key-controls"><span id="chart-key-label">Tom</span><button type="button" id="chart-down" aria-label="Diminuir tom em um semitom">−</button><output id="chart-key" aria-label="Tom da cifra">—</output><button type="button" id="chart-up" aria-label="Aumentar tom em um semitom">+</button><button type="button" id="chart-tones-toggle" aria-expanded="false" aria-controls="chart-tones-panel">12 tons</button></div><div class="chart-play-controls"><button type="button" id="chart-top" aria-label="Voltar ao início da cifra">↑ Início</button><button type="button" id="chart-play" aria-label="Iniciar rolagem automática" aria-pressed="false">▶ Play</button><label for="chart-speed">Velocidade <output id="chart-speed-value">24</output><input id="chart-speed" type="range" min="5" max="100" step="1" value="24" aria-label="Velocidade da rolagem"></label></div></footer>`;document.body.append(overlay);scroll=$('chart-scroll');scroller=new AutoScroller(scroll,{onStop:()=>{$('chart-play').textContent='▶ Play';$('chart-play').setAttribute('aria-pressed','false');$('chart-play').setAttribute('aria-label','Iniciar rolagem automática');releaseWake();}});
 $('chart-close').onclick=close;$('chart-edit').onclick=edit;$('chart-cancel').onclick=()=>{if(dirty&&!confirm('Descartar as alterações da cifra?'))return;dirty=false;showSheet()};$('chart-editor').oninput=()=>dirty=true;$('chart-editor').onsubmit=saveChart;
 $('chart-up').onclick=()=>changeKey(1);$('chart-down').onclick=()=>changeKey(-1);
 $('chart-tones-toggle').onclick=()=>{scroller.stop();const panel=$('chart-tones-panel');panel.hidden=!panel.hidden;$('chart-tones-toggle').setAttribute('aria-expanded',String(!panel.hidden))};
 $('chart-tones').onclick=e=>{const button=e.target.closest('[data-chart-key]');if(button&&!button.disabled)selectKey(button.dataset.chartKey)};
 $('chart-layout').onclick=()=>{if(!current?.chart||saving)return;const position=scroll.scrollTop;current.flow=!current.flow;showSheet();scroll.scrollTop=position};
 if(window.ResizeObserver)new ResizeObserver(fitFaithful).observe(scroll);else window.addEventListener('resize',fitFaithful);

 $('chart-speed').oninput=e=>{scroller.speed=Number(e.target.value);$('chart-speed-value').textContent=e.target.value};
 $('chart-play').onclick=()=>{if(scroller.running){scroller.stop();return}scroller.start();if(scroller.running){$('chart-play').textContent='Ⅱ Pausar';$('chart-play').setAttribute('aria-pressed','true');$('chart-play').setAttribute('aria-label','Pausar rolagem automática');keepAwake();}};
 $('chart-top').onclick=()=>{scroller.stop();scroll.scrollTop=0};$('chart-fullscreen').onclick=async()=>{try{if(document.fullscreenElement===overlay)await document.exitFullscreen();else if(overlay.requestFullscreen)await overlay.requestFullscreen();else say('Tela cheia do navegador indisponível. O leitor já ocupa toda a área disponível.');}catch{say('Tela cheia indisponível. O leitor continua aberto na área disponível.')}};
 document.addEventListener('fullscreenchange',()=>{if(overlay&&!overlay.hidden)$('chart-fullscreen').textContent=document.fullscreenElement===overlay?'Sair da tela cheia':'Tela cheia'});
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();return}if(e.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,a[href],input,textarea,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);const a=focusable[0],b=focusable.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}}if(e.code==='Space'&&!/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();$('chart-play').click()}});
 // Pause on manual scrolling or backgrounding; never jump after resuming.
 ['wheel','touchstart','pointerdown'].forEach(event=>scroll.addEventListener(event,()=>scroller.stop(),{passive:true}));
 scroll.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key))scroller.stop()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)scroller.stop()});window.addEventListener('pagehide',()=>scroller.stop());
}
async function keepAwake(){try{if(navigator.wakeLock&&!wake){const lock=await navigator.wakeLock.request('screen');if(!scroller.running){await lock.release();return}wake=lock;lock.addEventListener('release',()=>{if(wake===lock)wake=null});}}catch{/* optional browser capability */}}
function releaseWake(){const lock=wake;wake=null;if(lock)lock.release().catch(()=>{});}
function controls(enabled){['chart-down','chart-up','chart-play','chart-top','chart-speed'].forEach(id=>$(id).disabled=!enabled);$('chart-edit').disabled=!current?.loaded||saving;
 $('chart-tones-toggle').disabled=saving||!current?.chart?.content||!$('chart-editor').hidden;
 $('chart-layout').disabled=saving||!current?.chart?.content||!$('chart-editor').hidden;
 overlay.querySelectorAll('[data-chart-key]').forEach(b=>b.disabled=saving);}
function displayKey(){const original=current.chart?.original_key||current.song.song_key;const chosen=current.chosen||original;const base=keyInfo(original),target=keyInfo(chosen);if(!base||!target||base.minor!==target.minor)return null;return {original,chosen,steps:mod(target.pitch-base.pitch),flat:target.flat};}
function fitFaithful(){
 if(!overlay||overlay.hidden||$('chart-sheet').hidden)return;
 const pre=$('chart-sheet').querySelector('.chart-faithful');$('chart-fit-hint').hidden=true;if(!pre)return;
 const preferred=window.innerWidth<=700?17:20;pre.style.fontSize=preferred+'px';
 const available=$('chart-sheet').clientWidth;const natural=pre.getBoundingClientRect().width;
 const fitted=natural>available?preferred*available/natural:preferred;
 pre.style.fontSize=Math.max(.001,fitted)+'px';$('chart-fit-hint').hidden=fitted>=12;
}
function renderTones(){const original=current.chart?.original_key||current.song.song_key;const selected=displayKey();
 $('chart-tones').innerHTML=keyChoices(original).map(k=>'<button type="button" data-chart-key="'+esc(k.key)+'" aria-pressed="'+String(selected?.steps===mod(k.pitch-keyInfo(original).pitch))+'" title="'+(k.original?'Tom original cadastrado':'Transposição calculada pelo aplicativo')+'">'+esc(k.key)+(k.original?' <small>original</small>':'')+'</button>').join('');
 $('chart-tones-panel').hidden=true;$('chart-tones-toggle').setAttribute('aria-expanded','false');
}
function showSheet(){scroller.stop();$('chart-editor').hidden=true;$('chart-sheet').hidden=false;$('chart-edit').hidden=false;$('chart-key-label').textContent=current.serviceId?'Tom no culto':'Tom de leitura';const k=displayKey();$('chart-key').textContent=k?.chosen||'—';const has=!!current.chart?.content;
 const renderer=current.flow?renderFlowChart:renderChart;
 $('chart-sheet').innerHTML=has?renderer(current.chart.content,k?.steps||0,k?.flat||false):'<div class="chart-empty"><h3>A cifra ainda não foi cadastrada.</h3><p>Adicione uma cifra própria ou autorizada em “Editar cifra própria”, ou consulte o link externo.</p></div>';
 $('chart-layout').textContent=current.flow?'Layout original':'Leitura fluida';
 $('chart-provenance').textContent=has?'Original cadastrado: '+current.chart.original_key+' · Outros tons: transposições calculadas pelo aplicativo.'+(current.flow?' Visualização adaptada por trechos.':isInlineChart(current.chart.content)?' Formato ChordPro.':' Layout original preservado.'):'O link externo é uma referência; a cifra precisa ser cadastrada manualmente.';
 renderTones();controls(has&&!!k&&!saving);fitFaithful();
 if(has&&!k)say('Tom não reconhecido ou modo maior/menor diferente. Exibindo a cifra original. Escolha um dos 12 tons para revisar.');scroll.scrollTop=0;
}
async function open(song,serviceId,trackId){if(!api||!api.getDb())throw new Error('Aguarde a conexão com o Firebase.');if(!song)throw new Error('Música indisponível.');create();if(!overlay.hidden)return;const token=++epoch;returnFocus=document.activeElement;current={song,serviceId,trackId,chart:null,flow:false,chosen:serviceId?api.getTrack(serviceId,trackId)?.chosen_key||'':'',loaded:false};dirty=false;saving=false;overlay.hidden=false;document.body.classList.add('chart-reader-open');background=[...document.body.children].filter(x=>x!==overlay&&!['SCRIPT','LINK','STYLE'].includes(x.tagName)).map(x=>[x,x.inert]);background.forEach(([x])=>x.inert=true);$('chart-title').textContent=song.title;$('chart-artist').textContent=song.artist||'';$('chart-content').value='';$('chart-editor').hidden=true;$('chart-sheet').hidden=false;$('chart-sheet').textContent='Carregando cifra…';$('chart-key').textContent='—';$('chart-provenance').textContent='';$('chart-fit-hint').hidden=true;$('chart-tones-panel').hidden=true;say('');const a=$('chart-external');a.hidden=true;a.removeAttribute('href');try{const url=new URL(song.chords_url);if(['http:','https:'].includes(url.protocol)){a.href=url.href;a.hidden=false}}catch{}controls(false);$('chart-close').focus();try{const store=new ChartStore(api.getDb(),()=>firebase.firestore.FieldValue.serverTimestamp());const chart=await store.read(song.id);if(token!==epoch)return;current.chart=chart;current.loaded=true;showSheet();}catch(e){if(token!==epoch)return;controls(false);say(api.error(e));$('chart-sheet').innerHTML='<div class="chart-empty">Não foi possível carregar a cifra. Feche e tente novamente. O link externo continua disponível.</div>';}}
function edit(){if(!current?.loaded||saving)return;scroller.stop();$('chart-tones-panel').hidden=true;$('chart-tones-toggle').setAttribute('aria-expanded','false');$('chart-fit-hint').hidden=true;$('chart-sheet').hidden=true;$('chart-editor').hidden=false;$('chart-edit').hidden=true;$('chart-content').value=current.chart?.content||'';$('chart-original-key').value=current.chart?.original_key||current.song.song_key||'';dirty=false;controls(false);say('');$('chart-content').focus();}
async function saveChart(e){e.preventDefault();if(saving)return;saving=true;$('chart-save').disabled=true;$('chart-cancel').disabled=true;say('Salvando cifra…');try{const store=new ChartStore(api.getDb(),()=>firebase.firestore.FieldValue.serverTimestamp());current.chart=await store.save(current.song.id,$('chart-content').value,$('chart-original-key').value.trim(),current.chart);dirty=false;showSheet();say('Cifra própria salva no Firebase.');}catch(error){say(api.error(error))}finally{saving=false;$('chart-save').disabled=false;$('chart-cancel').disabled=false;if($('chart-editor').hidden)controls(!!current.chart?.content&&!!displayKey());}}
async function changeKey(direction){const key=displayKey();if(key)await selectKey(transposeKey(key.chosen,direction));}
async function selectKey(next){if(saving||!current?.chart)return;
 const original=keyInfo(current.chart.original_key),target=keyInfo(next);if(!original||!target||original.minor!==target.minor)return;
 scroller.stop();saving=true;controls(false);say(current.serviceId?'Salvando tom deste culto…':'');const position=scroll.scrollTop;
 try{if(current.serviceId)await api.saveKey(current.serviceId,current.trackId,next,current.chosen);current.chosen=next;showSheet();scroll.scrollTop=position;say(current.serviceId?'Tom salvo somente neste culto.':'Tom de leitura; a cifra original foi preservada.');}
 catch(e){say(api.error(e))}finally{saving=false;controls(!!displayKey());}}
async function close(){if(saving){say('Aguarde o salvamento terminar antes de fechar.');return}if(dirty&&!confirm('Descartar as alterações da cifra?'))return;epoch++;scroller.stop();dirty=false;if(document.fullscreenElement===overlay)try{await document.exitFullscreen()}catch{}overlay.hidden=true;document.body.classList.remove('chart-reader-open');background.forEach(([x,value])=>x.inert=value);background=[];current=null;returnFocus?.focus();}
root.LouvorCharts={init:options=>{api=options},open};
})(typeof window==='undefined'?globalThis:window);

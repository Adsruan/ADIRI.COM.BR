const {test}=require('node:test');const assert=require('node:assert/strict');
const {transposeChord,transposeKey,keyInfo,renderChart,AutoScroller,ChartStore}=require('../charts.js');
test('sustenidos, bemóis, inversões e acordes complexos',()=>{
 for(const [a,n,flat,b] of [['C',2,false,'D'],['B',1,false,'C'],['C',-1,false,'B'],['F#',1,true,'G'],['Bbmaj7/D',2,false,'Cmaj7/E'],['C#m7(b5)/G#',1,false,'Dm7(b5)/A'],['G7(#9,b13)',-2,true,'F7(#9,b13)'],['F#m7(11)',3,true,'Am7(11)'],['C6/9',2,false,'D6/9'],['Bø7/F',1,true,'Cø7/Gb'],['E♭7/B♭',2,true,'F7/C'],['G#dim7',1,false,'Adim7'],['Cadd9',-2,true,'Bbadd9'],['C##',1,false,'D#']])assert.equal(transposeChord(a,n,flat),b,a);
 assert.equal(transposeChord('Letra de verdade',2),'Letra de verdade');assert.equal(transposeChord('Bb',12,false),'Bb');
});
test('tom menor, ciclos e enarmonia não alteram o original',()=>{assert.equal(transposeKey('Am',1),'A#m');assert.equal(transposeKey('Bb',-1),'A');assert.equal(transposeKey('F',1),'Gb');assert.equal(transposeKey('C',12),'C');assert.equal(keyInfo('inválido'),null);for(const chord of ['Cmaj7','F#7/A#','Am7','Bb7(#11)']){let c=chord;for(let i=0;i<12;i++)c=transposeChord(c,1,false);assert.equal(keyInfo(c.match(/^[A-G][#b]?/)[0]).pitch,keyInfo(chord.match(/^[A-G][#b]?/)[0]).pitch)}});
test('alinhamento tradicional e ChordPro, letras e HTML preservados',()=>{const source='C           G/B\nMinha letra aqui\n\n[Refrão]\n[Am7]Nossa voz [F#7(b9)]canta\n<script>alert(1)</script>';const out=renderChart(source,2,false);assert.match(out,/chart-chord">D</);assert.match(out,/chart-chord">A\/C#</);assert.match(out,/chart-chord">Bm7</);assert.match(out,/G#7\(b9\)/);assert.match(out,/Minha letra/);assert.match(out,/\[Refrão\]/);assert.doesNotMatch(out,/<script>/);assert.match(out,/&lt;script&gt;/);assert.equal(source.includes('G/B'),true);assert.match(renderChart('A vida continua\nSem acordes',2),/A vida continua/)});
test('rolagem contínua depende do tempo, pausa, retoma e para no final',()=>{let callback,id=0,stops=0;const view={scrollTop:0,clientHeight:200,scrollHeight:1000};const s=new AutoScroller(view,{raf:cb=>(callback=cb,++id),caf:()=>{},onStop:()=>stops++});s.speed=40;s.start();callback(0);callback(100);assert.equal(view.scrollTop,4);s.stop();callback(200);assert.equal(view.scrollTop,4);view.scrollTop=799;s.start();callback(1000);callback(1100);assert.equal(view.scrollTop,800);assert.equal(s.running,false);assert.equal(stops,2);s.start();assert.equal(s.running,false)});
test('passos fracionários não param em velocidade baixa; background não gera salto',()=>{let cb;const view={scrollTop:0,clientHeight:10,scrollHeight:1000};const s=new AutoScroller(view,{raf:f=>(cb=f,1),caf:()=>{}});s.speed=5;s.start();cb(0);for(let t=16;t<=160;t+=16)cb(t);assert.ok(view.scrollTop>.7);cb(10000);assert.ok(view.scrollTop<1.4)});
function store(initial=null){let data=initial,writes=0;const ref={id:'song',get:async()=>({exists:!!data,data:()=>data})};const db={collection:name=>{assert.equal(name,'charts');return {doc:id=>{assert.equal(id,'song');return ref}}},runTransaction:async f=>f({get:async()=>({exists:!!data,data:()=>data}),set:(r,value)=>{data=value;writes++}})};return {s:new ChartStore(db,()=> 'server-time'),get:()=>data,writes:()=>writes,set:v=>data=v}}
test('cifra própria salva e lida do Firebase com versão; original não é transposto',async()=>{const f=store();const original='[C]Canção própria';let saved=await f.s.save('song',original,'C',null);assert.equal(saved.revision,1);assert.equal((await f.s.read('song')).content,original);renderChart(original,2);assert.equal(f.get().content,original);saved=await f.s.save('song',original+'\nNova estrofe','C',saved);assert.equal(saved.revision,2);assert.equal(saved.created_at,'server-time');assert.equal(f.writes(),2)});
test('conflito ou dados inválidos não sobrescrevem a cifra',async()=>{const f=store({content:'Original',revision:2,created_at:'old'});await assert.rejects(f.s.save('song','Novo','C',{revision:1}),/outro dispositivo/);await assert.rejects(f.s.save('song',' ','C',null),/60.000/);await assert.rejects(f.s.save('song','A'.repeat(60001),'C',null),/60.000/);await assert.rejects(f.s.save('song','Texto','ZZ',null),/Informe um tom/);assert.equal(f.writes(),0);assert.equal(f.get().content,'Original')});
test('regras e integração são aditivas, sem scraping nem expiração',()=>{const fs=require('node:fs');const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('charts.js','utf8'),rules=fs.readFileSync('firestore.rules','utf8');assert.match(html,/Ver cifra/);assert.match(html,/tracks\[i\]=\{\.\.\.tracks\[i\],chosen_key:key\}/);assert.match(rules,/match \/charts\/\{songId\}/);assert.match(rules,/resource.data.revision \+ 1/);assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|innerHTML\s*=\s*(?:content|song)/);assert.match(js,/visibilitychange/);assert.match(js,/requestFullscreen/);assert.match(js,/releaseWake/)});

test('texto tradicional mantém espaços, tabs, linhas vazias e posições originais',()=>{
 const {renderPlainChart,visualColumns}=require('../charts.js');
 const input='  C    G/B  \n  Minha letra exata  \n\n\tAm7\tF#7(b9)\n\tÚltima estrofe\n';
 const visible=renderPlainChart(input).replace(/^<pre[^>]*>|<\/pre>$/g,'').replace(/<\/?b[^>]*>/g,'');
 assert.equal(visible,input);assert.equal(visualColumns('\tAm7\t'),8);
 const shifted=renderPlainChart('C G/B\nUma letra',1);assert.match(shifted,/width:2ch/);assert.match(shifted,/>Db<|>C#</);assert.match(shifted,/G#\/C/);assert.match(shifted,/\nUma letra<\/pre>/);
});
test('12 tons calculados mantêm modo menor, original e progressão para todos os destinos',()=>{
 const {keyChoices,pitch}=require('../charts.js');
 for(const original of ['C','Bb','F#','Am','Ebm']){
  const choices=keyChoices(original);assert.equal(choices.length,12);assert.equal(new Set(choices.map(x=>x.pitch)).size,12);assert.equal(choices.filter(x=>x.original).length,1);assert.equal(choices.find(x=>x.original).key,original);
  for(const choice of choices){const steps=keyInfo(choice.key).pitch-keyInfo(original).pitch;for(const chord of ['Am7','Fmaj7','C/G','E7(b9)','Bb7sus4','F#m7/A']){
   const out=transposeChord(chord,steps,keyInfo(choice.key).flat);const root=out.match(/^[A-G][#b]{0,2}/)[0],before=chord.match(/^[A-G][#b]{0,2}/)[0];assert.equal((pitch(root)-pitch(before)+12)%12,(steps+12)%12);assert.equal(out.replace(/^[A-G][#b]{0,2}/,'').split('/')[0],chord.replace(/^[A-G][#b]{0,2}/,'').split('/')[0]);
  }}
 }
});

test('salvamento preserva integralmente espaços, tabulações e linhas finais',async()=>{
 const f=store(),text='  Am   F  \n\tLetra própria  \n\n';await f.s.save('song',text,'Am',null);assert.equal((await f.s.read('song')).content,text);
});
test('baixo das inversões transpõe pelos mesmos semitons nos 12 destinos',()=>{
 const {pitch}=require('../charts.js');for(let step=0;step<12;step++)for(const chord of ['C/G','F#m7/A','Bbmaj7/D','Bø7/F']){
  const original=chord.match(/\/([A-G][#b]{0,2})$/)[1];const result=transposeChord(chord,step,true).match(/\/([A-G][#b]{0,2})$/)[1];assert.equal((pitch(result)-pitch(original)+12)%12,step);
 }
});

test('anotações de repetição e seções não impedem a transposição nem viram acordes',()=>{
 const {renderPlainChart}=require('../charts.js');const html=renderPlainChart('[Intro] Am  Fmaj7  C/G  E7(b9) (2x)\nA letra é mantida.\nN.C.  Am  G7sus4',2);
 for(const chord of ['Bm','Gmaj7','D/A','F#7(b9)','A7sus4'])assert.ok(html.includes('>'+chord+'<'),chord);
 assert.match(html,/>\[Intro\]</);assert.match(html,/>\(2x\)</);assert.match(html,/A letra é mantida\./);assert.match(html,/>N\.C\.</);
});

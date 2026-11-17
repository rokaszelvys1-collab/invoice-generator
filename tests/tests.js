const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let fails=0;const A=(c,msg)=>{if(!c){console.log('FAIL',msg);fails++}else console.log('ok  ',msg)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function page(claude){
  const vc=new VirtualConsole();vc.on('error',e=>{console.log('PAGE console.error:',e&&e.stack||e)});vc.on('jsdomError',e=>{console.log('JSDOM ERROR:',e.message,e.detail&&e.detail.stack||'');fails++});
  const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){if(claude)w.claude=claude;w.pdfMake={vfs:{},createPdf:def=>({getBase64:cb=>cb(Buffer.from('%PDF-fake '+JSON.stringify(def.info)).toString('base64'))})}}});
  const w=d.window,doc=w.document;
  return {w,doc,q:s=>doc.querySelector(s),qa:s=>[...doc.querySelectorAll(s)],
    click:s=>{const e=typeof s==='string'?doc.querySelector(s):s;if(!e)throw new Error('missing '+s);e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))},
    type:(s,v)=>{const e=doc.querySelector(s);if(!e)throw new Error('missing '+s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}))}};
}
function fakeDb(){
  const docs=new Map(),subs=[];let lease=null;
  const cp=x=>JSON.parse(JSON.stringify(x)),notify=()=>setTimeout(()=>subs.slice().forEach(f=>f()),3);
  const snap=p=>({id:p.split('/').pop(),exists:docs.has(p),data:()=>docs.has(p)?Object.freeze(cp(docs.get(p))):undefined,metadata:{fromCache:false,hasPendingWrites:false}});
  const doc=p=>({id:p.split('/').pop(),path:p,get:async()=>snap(p),
    set:async d=>{if(!d||typeof d!=='object')throw {code:'invalid_argument'};await wait(8);docs.set(p,cp(d));notify()},
    delete:async()=>{await wait(5);docs.delete(p);notify()},
    acquire:async o=>{await wait(3);if(lease&&lease.holder!==o.holder&&lease.until>Date.now())return {acquired:false,expiresAt:''};lease={holder:o.holder,until:Date.now()+(o.ttlMs||30000)};return {acquired:true,holder:o.holder}},
    onSnapshot:(next)=>{const f=()=>next(snap(p));subs.push(f);setTimeout(f,15);return ()=>{}}});
  const collection=c=>({path:c,doc:id=>doc(c+'/'+id),
    onSnapshot:(next)=>{const f=()=>{const ds=[...docs.keys()].filter(k=>k.startsWith(c+'/')&&k.split('/').length===2).sort().map(snap);next({docs:ds,size:ds.length,empty:!ds.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}})};subs.push(f);setTimeout(f,15);return ()=>{}}});
  return {doc,collection,_docs:docs,_notify:notify};
}
const web=[{"url":"https://rekvizitai.vz.lt/imone/recaras/juridinis-asmuo/","title":"UAB Recaras juridinio asmens duomenys ... - Rekvizitai.lt","description":"UAB Recaras Adresas: Garažų g. 4A, Narėpų k., LT-54470 Kauno r. Tel.: +370 614 27277 Įmonės kodas: 303309407 PVM mokėtojo kodas: LT100010882013 A/s: LT ..."}];
function fakeMcp(state){return {callTool:async(server,tool,input,opts)=>{state.calls.push({server,tool,input});await wait(5);
  if(tool==='firecrawl_scrape'){const v=state.vies;if(v==='down')throw {code:'server_unavailable',retryable:true};
    return {payload:{markdown:'```json\n'+JSON.stringify(v==='ms'?{isValid:false,userError:'MS_UNAVAILABLE',name:'---',address:'---'}:{isValid:v==='valid',userError:v==='valid'?'VALID':'INVALID',requestDate:'2026-11-17T11:00:00Z',name:v==='valid'?'SIA "Paraugs Parts"':'---',address:'N/A'})+'\n```'}}}
  if(tool==='firecrawl_search')return {payload:{success:true,data:{web}}};
  if(tool==='send_message'){if(state.mailFail)throw {code:state.mailFail};return {payload:{id:'m1'}}}
  throw {code:'not_in_manifest'}}}}
const claudeWith=caps=>({use:async n=>{await wait(4);return caps[n]||null}});

(async()=>{
  // ---------- A. browser-only mode ----------
  let P=page(null);await wait(60);
  for(const v of ['saskaitos','klientai','mokejimai','eksportas','nustatymai','pradzia']){P.click(`[data-v="${v}"]`);A(P.q('#main h1'),'A view '+v)}
  A(P.q('.note').textContent.includes('tik šioje naršyklėje'),'A local mode note');
  P.click('[data-v="mokejimai"]');P.click('[data-act="bankDemo"]');A(P.qa('#bank-out tbody tr').length===3,'A bank 3 matches');P.click('[data-act="bankApply"]');
  P.click('[data-act="new"]');A(P.q('#e-no').disabled&&P.q('#e-no').value==='4808','A number is a read-only preview');
  P.type('#e-cq','Camille');P.click('#e-cl button');A(P.q('#e-rule').textContent.includes('OSS: Prancūzija 20'),'A FR OSS rule');
  P.type('[data-l="0"][data-k="name"]','Test part');P.type('[data-l="0"][data-k="price"]','100');A(P.q('#e-tot').textContent.includes('120,00'),'A total 120');
  P.type('#e-cur','PLN');A(P.q('#e-tot').textContent.includes('eurais'),'A PLN shows EUR');P.click('[data-act="lang"][data-v="pl"]');
  P.click('[data-act="saveFinal"]');await wait(40);
  A(P.q('#dw h1')&&P.q('#dw h1').textContent==='SAK 4808','A saved SAK 4808 / '+(P.q('#ederr')?P.q('#ederr').textContent:''));
  A(!P.q('#dw [data-act="edit"]')&&!P.q('#dw [data-act="del"]'),'A issued invoice has no edit/delete');
  A(P.q('#dw').textContent.includes('užrakinta'),'A lock note');A(/Słownie: sto dwadzieścia PLN 00\/100/.test(P.q('#dw .paper').textContent),'A Polish amount in words: '+(P.q('#dw .pw')||{}).textContent);
  A(P.q('#dw').textContent.includes('Sąskaita išrašyta SAK 4808'),'A history event');
  P.w.eval("window.__lock=(function(){const o=S.invoices.find(i=>i.series==='SAK');ACT.edit({dataset:{id:o.id}});const e1=E;ACT.del({dataset:{id:o.id,step:'1'}});return [e1===null||e1.id!==o.id,S.invoices.some(i=>i.id===o.id)]})()");
  A(P.w.__lock[0]&&P.w.__lock[1],'A lock also enforced in code');
  P.click('#dw [data-act="credit"]');A(P.q('[data-l="0"][data-k="qty"]').value==='-1','A credit negative');P.click('[data-act="saveFinal"]');await wait(40);A(P.q('#dw h1').textContent==='KR 1','A credit KR 1');
  P.click('#dw [data-act="close"]');A(P.q('#invlist').textContent.includes('Kredituota'),'A list marks credited invoice');
  P.click('[data-act="new"]');P.type('#e-cq','Juodraštis UAB');P.type('[data-l="0"][data-k="name"]','X');P.type('[data-l="0"][data-k="price"]','10');P.click('[data-act="saveDraft"]');await wait(30);
  A(P.q('#dw h1').textContent==='Juodraštis'&&P.q('#dw [data-act="edit"]')&&P.q('#dw [data-act="del"]'),'A draft editable');
  P.click('#dw [data-act="edit"]');P.click('[data-act="saveFinal"]');await wait(40);A(P.q('#dw h1').textContent==='SAK 4809','A draft issued as SAK 4809 (no gap)');
  P.click('#dw [data-act="mail"]');A(P.q('#m-to')&&!P.q('[data-act="mailSend"]'),'A mail panel without send when no connector');
  P.click('#dw [data-act="close"]');P.click('[data-v="eksportas"]');P.click('[data-act="xReg"]');await wait(20);A(P.q('#xt')&&P.q('#xt').value.includes('VIES tikrinta'),'A register export has VIES columns');
  P.w.eval("window.__w=[0,1,2,5,12,21,22,101,1000,2001,5000,21512,128005,1000000,2000000].map(n=>words(n,'pl')).join(' | ')");console.log('     pl:',P.w.__w);

  // ---------- B. connectors: VIES on save, mail ----------
  const st={calls:[],vies:'valid'};P=page(claudeWith({mcp:fakeMcp(st)}));await wait(80);
  A(P.q('.note').textContent.includes('tik šioje naršyklėje'),'B no db -> local mode');
  const b2b=async()=>{P.click('[data-act="new"]');P.type('#e-cq','SIA Paraugs');P.click('#e-cl button');P.type('[data-l="0"][data-k="name"]','Gearbox');P.type('[data-l="0"][data-k="price"]','500');P.click('[data-act="saveFinal"]');await wait(80)};
  await b2b();A(P.q('#dw h1').textContent==='SAK 4808'&&P.q('#dw').textContent.includes('VIES: PVM kodas galioja'),'B valid VIES stored with invoice');
  A(st.calls.filter(c=>c.tool==='firecrawl_scrape').length===1&&st.calls[0].input.url.endsWith('/ms/LV/vat/40000000001'),'B VIES url');
  P.w.eval("window.__v=S.invoices.find(i=>i.no===4808).vies");A(P.w.__v.valid===true&&/^\d{4}-/.test(P.w.__v.checkedAt)&&P.w.__v.name.includes('Paraugs'),'B proof fields '+JSON.stringify(P.w.__v));
  P.click('#dw [data-act="mail"]');A(P.q('[data-act="mailSend"]'),'B send button');P.type('#m-to','bad');P.click('[data-act="mailSend"]');A(P.q('#m-err').textContent.includes('teisingą'),'B bad address refused');
  P.type('#m-to','parts@paraugs.example');P.click('[data-act="mailSend"]');await wait(80);
  const sm=st.calls.find(c=>c.tool==='send_message');A(sm&&sm.server==='Gmail'&&sm.input.to[0]==='parts@paraugs.example'&&sm.input.attachments[0].filename==='SAK_Nr._4808_-_'+P.w.eval('today()')+'_SIA_Paraugs_Parts.pdf'&&sm.input.attachments[0].content.length>10,'B mail sent with PDF: '+(sm&&sm.input.attachments[0].filename));
  A(P.q('#dw').textContent.includes('Išsiųsta pirkėjui')&&st.calls.filter(c=>c.tool==='send_message').length===1,'B send log, single send');
  st.mailFail='server_unavailable';P.click('#dw [data-act="mail"]');P.click('[data-act="mailSend"]');await wait(60);A(P.q('#m-err').textContent.includes('galėjo būti išsiųstas'),'B ambiguous send warned');
  P.click('#dw [data-act="close"]');
  st.vies='invalid';P.w.eval("for(const k in VC)delete VC[k]");P.click('[data-act="new"]');P.type('#e-cq','SIA Paraugs');P.click('#e-cl button');P.type('[data-l="0"][data-k="name"]','G');P.type('[data-l="0"][data-k="price"]','5');P.click('[data-act="saveFinal"]');await wait(60);
  A(P.q('#ederr').textContent.includes('negalioja')&&P.w.eval("S.invoices.length")===7,'B invalid VAT blocks 0 % invoice');
  P.click('[data-act="saveFinal"]');await wait(60);A(P.q('#dw h1').textContent==='SAK 4809'&&P.q('#dw').textContent.includes('VIES: PVM kodas negalioja'),'B second click issues and records invalid');
  st.vies='ms';P.click('#dw [data-act="viesRe"]');await wait(60);A(P.q('#dw').textContent.includes('VIES: nepatikrinta')&&P.q('#dw').textContent.includes('MS_UNAVAILABLE'),'B member-state outage is not treated as invalid');
  P.click('#dw [data-act="close"]');P.click('[data-act="new"]');P.type('#e-cq','Recaras');P.type('#b-vat','LT100010882013');st.vies='valid';P.click('[data-act="lookup"]');await wait(80);A(P.q('#e-lk').textContent.includes('303309407'),'B web lookup still works');

  // ---------- C. shared database ----------
  const db=fakeDb(),user={id:async()=>'u_rokas',can:async()=>true,profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{name:i==='u_rokas'?'Rokas':'Viktorija'}]))};
  P=page(claudeWith({db,user,mcp:fakeMcp({calls:[],vies:'valid'})}));
  A(P.q('#main').textContent.includes('Kraunami'),'C loading state first');await wait(120);
  A(P.q('.note').textContent.includes('Bendra duomenų bazė')&&P.q('#main').textContent.includes('Čia dar nėra sąskaitų'),'C db mode, empty state');
  P.click('[data-act="new"]');P.type('#e-cq','Pirkėjas Vienas, UAB');P.type('[data-l="0"][data-k="name"]','Durys');P.type('[data-l="0"][data-k="price"]','200');P.click('[data-act="saveFinal"]');await wait(150);
  const inv1=[...db._docs.entries()].find(([k])=>k.startsWith('invoices/'));
  A(inv1&&inv1[1].series==='SAK'&&inv1[1].no===4808&&inv1[1].issuedBy==='u_rokas'&&inv1[1].saveClient===undefined,'C invoice document written');
  A(db._docs.get('meta/settings').next.vat===4809,'C counter stored');A([...db._docs.keys()].some(k=>k.startsWith('clients/'))&&[...db._docs.keys()].some(k=>k.startsWith('events/')),'C client and event documents');
  A(P.q('#dw').textContent.includes('Rokas'),'C history shows who');
  // another person, same database
  const user2={id:async()=>'u_vikt',can:async()=>true,profiles:user.profiles};const P2=page(claudeWith({db,user:user2}));await wait(150);
  P2.click('[data-v="saskaitos"]');A(P2.q('#invlist').textContent.includes('SAK 4808'),'C second person sees the invoice');
  P2.click('#invlist tr.click');P2.click('#dw [data-act="pay"]');await wait(120);
  P.click('#dw [data-act="close"]');P.click('[data-v="saskaitos"]');await wait(40);A(P.q('#invlist').textContent.includes('Apmokėta'),'C payment by second person shows for the first');
  P2.click('#dw [data-act="close"]');P2.click('[data-act="new"]');P2.type('#e-cq','Pirkėjas Du');P2.type('[data-l="0"][data-k="name"]','Y');P2.type('[data-l="0"][data-k="price"]','1');P2.click('[data-act="saveFinal"]');
  await wait(300);A(P2.q('#ederr')&&P2.q('#ederr').textContent.includes('Suteikiamas numeris'),'C second person waits for the numbering lease');
  await wait(5200);A(P2.q('#dw h1')&&P2.q('#dw h1').textContent==='SAK 4809','C second person gets the next number: '+(P2.q('#dw h1')||{}).textContent+' / '+(P2.q('#ederr')||{}).textContent);
  const nos=[...db._docs.entries()].filter(([k])=>k.startsWith('invoices/')).map(([,v])=>v.no).sort();A(nos.join()==='4808,4809','C numbers unique and gapless: '+nos);
  // settings typing is not lost to snapshots
  P.click('[data-v="nustatymai"]');P.type('[data-s="company.iban"]','LT00');await wait(20);P.type('[data-s="company.iban"]','LT00TEST');await wait(900);A(db._docs.get('meta/settings').company.iban==='LT00TEST','C settings saved after pause');
  // read-only viewer
  const P3=page(claudeWith({db,user:{id:async()=>'u_x',can:async()=>false,profiles:user.profiles}}));await wait(150);A(P3.q('.note').textContent.includes('Tik peržiūra'),'C read-only viewer flagged');
  P3.click('[data-act="new"]');P3.type('#e-cq','Z');P3.type('[data-l="0"][data-k="name"]','Y');P3.type('[data-l="0"][data-k="price"]','1');P3.click('[data-act="saveFinal"]');await wait(50);A(P3.q('#ederr').textContent.includes('Neturite teisės'),'C read-only cannot save');
  console.log(fails?('FAILED '+fails):'ALL PASSED');process.exit(fails?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(1)});

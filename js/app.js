import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, GRUPO } from './config.js';
import { pad, mesAdd, jogosDoMes, slug, pixPayload } from './logica.js';

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const hojeD=new Date();
const mesAtual=`${hojeD.getFullYear()}-${pad(hojeD.getMonth()+1)}`;
const hojeISO=`${mesAtual}-${pad(hojeD.getDate())}`;
const VIEWS={'#uniforme':'uniforme','#situacao':'situacao'};
const S={view:(VIEWS[location.hash]||'mensal'),eu:null,freqPer:'mes',uni:{},uniPix:1,membros:[],pag:{},desp:[],avul:[],jogos:{},jogoSel:null,msgTipo:'cobranca',cfg:{valor2x:85,valor1x:50,pix:'',pixNome:'Jansey Oliveira',pixCidade:'Sao Paulo',cobranca:1,vencimento:10,valorAvulso:20,uniValor:90,uniMeta:10,uniPrazo:'2026-11-05',minSab:10,minTer:8,saldoInicial:0},qrPlano:'2x',
  mes:mesAtual,filtro:'todos',pode:false,db:null,aberto:null,ok:{m:false,p:false,d:false,c:false,a:false,j:false,u:false},semDb:false};
try{const f=localStorage.getItem('mensal_filtro'); if(f) S.filtro=f; S.eu=localStorage.getItem('mensal_eu')}catch(e){}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2});
const mesLongo=m=>{const [y,mm]=m.split('-');return `${MESES[+mm-1]} ${y}`};
const dataBR=d=>d?d.split('-').reverse().slice(0,2).join('/'):'';
const ativoNo=(mb,m)=>(mb.desde||'0000-00')<=m && (!mb.ate || m<=mb.ate);
const valorPlano=mb=>mb.plano==='1x'?Number(S.cfg.valor1x):Number(S.cfg.valor2x);
const pagDe=(mb,m)=>S.pag[`${m}_${mb.id}`];
function devido(mb,m){const p=pagDe(mb,m);if(p&&p.status==='isento')return 0;if(p&&p.status==='pago')return Number(p.valor);return valorPlano(mb)}
function atrasos(mb){ // meses anteriores ao selecionado sem pagamento
  const out=[];let m=mb.desde||S.mes;
  while(m<S.mes){ if(ativoNo(mb,m)&&!pagDe(mb,m)) out.push(m); m=mesAdd(m,1); if(out.length>36)break }
  return out;
}
const prazoTxt=m=>`${pad(S.cfg.vencimento||10)}/${m.slice(5)}`;
const vencido=m=>m<mesAtual||(m===mesAtual&&hojeD.getDate()>Number(S.cfg.vencimento||10));
const DSEM=['dom','seg','ter','qua','qui','sex','sáb'];
const dow=iso=>new Date(iso+'T12:00:00').getDay();
const diaTxt=iso=>`${DSEM[dow(iso)]} ${dataBR(iso)}`;
function ultimoJogo(){const d=new Date(hojeD);for(let i=0;i<7;i++){if(d.getDay()===2||d.getDay()===6)break;d.setDate(d.getDate()-1)}return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
const HORA={2:'20:00',6:'09:00'}, DIA_LONGO={2:'Terça-feira',6:'Sábado'};
function jogoAtual(){const js=jogosDoMes(S.mes);if(S.jogoSel&&js.includes(S.jogoSel))return S.jogoSel;
  if(S.mes===mesAtual)return js.find(d=>d>=hojeISO)||js[js.length-1];return S.mes<mesAtual?js[js.length-1]:js[0]}
const minDe=iso=>dow(iso)===6?Number(S.cfg.minSab||10):Number(S.cfg.minTer||8);
const presentes=iso=>(S.jogos[iso]?.presentes||[]).filter(id=>S.membros.some(m=>m.id===id));
const nomeMb=id=>S.membros.find(m=>m.id===id)?.nome||'—';
const planoTxt=mb=>mb.plano==='1x'?`Sáb · ${brl(S.cfg.valor1x)}`:`Ter + Sáb · ${brl(S.cfg.valor2x)}`;
function qrImg(txt){try{const q=window.qrcode(0,'M');q.addData(txt);q.make();return q.createDataURL(6,2)}catch(e){return ''}}

function toast(t){const el=document.getElementById('toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,2600)}

function totais(){
  const ativos=S.membros.filter(mb=>ativoNo(mb,S.mes));
  let previsto=0,recebido=0,pagos=0,isentos=0;
  ativos.forEach(mb=>{const p=pagDe(mb,S.mes);previsto+=devido(mb,S.mes);
    if(p&&p.status==='pago'){recebido+=Number(p.valor);pagos++} if(p&&p.status==='isento')isentos++});
  const despMes=S.desp.filter(d=>d.mes===S.mes).reduce((a,d)=>a+Number(d.valor),0);
  const todasEntradas=Object.values(S.pag).filter(p=>p.status==='pago'&&p.mes<=S.mes).reduce((a,p)=>a+Number(p.valor),0);
  const todasSaidas=S.desp.filter(d=>d.mes<=S.mes).reduce((a,d)=>a+Number(d.valor),0);
  const avMes=S.avul.filter(a=>a.mes===S.mes);
  const avPago=avMes.filter(a=>a.pago).reduce((x,a)=>x+Number(a.valor),0);
  const avAberto=avMes.filter(a=>!a.pago).reduce((x,a)=>x+Number(a.valor),0);
  const avTodos=S.avul.filter(a=>a.pago&&a.mes<=S.mes).reduce((x,a)=>x+Number(a.valor),0);
  const caixa=Number(S.cfg.saldoInicial||0)+todasEntradas+avTodos-todasSaidas;
  return {ativos,previsto,recebido,falta:previsto-recebido,pagos,isentos,despMes,caixa,avMes,avPago,avAberto};
}

const cancelado=iso=>!!(S.jogos[iso]&&S.jogos[iso].cancelado);
const MOTIVOS=['Chuva','Feriado','Quadra fechada','Poucos confirmados','Outro'];
function frequencia(per){
  const ano=S.mes.slice(0,4);
  const jogos=Object.entries(S.jogos).filter(([iso,j])=>/^\d{4}-\d{2}-\d{2}$/.test(iso)&&iso<=hojeISO&&!j.cancelado&&(j.presentes||[]).length&&(per==='mes'?iso.slice(0,7)===S.mes:iso.slice(0,4)===ano));
  const cont={};jogos.forEach(([iso,j])=>(j.presentes||[]).forEach(id=>{cont[id]=(cont[id]||0)+1}));
  return {total:jogos.length,cont};
}
function historicoCaixa(){
  const meses=new Set();Object.values(S.pag).forEach(p=>meses.add(p.mes));S.desp.forEach(d=>meses.add(d.mes));S.avul.forEach(a=>meses.add(a.mes));
  S.membros.forEach(m=>m.desde&&meses.add(m.desde));
  let ini=[...meses].sort()[0]||mesAtual; const out=[]; let saldo=Number(S.cfg.saldoInicial||0);
  for(let m=ini;m<=mesAtual;m=mesAdd(m,1)){
    const ent=Object.values(S.pag).filter(p=>p.status==='pago'&&p.mes===m).reduce((x,p)=>x+Number(p.valor),0)+S.avul.filter(a=>a.pago&&a.mes===m).reduce((x,a)=>x+Number(a.valor),0);
    const sai=S.desp.filter(d=>d.mes===m).reduce((x,d)=>x+Number(d.valor),0);
    saldo+=ent-sai; out.push({m,ent,sai,saldo});
  }
  return out;
}
function graficoCaixa(H){
  const W=600,Ht=230,pl=8,pr=8,pt=26,pb=34, n=H.length;
  const max=Math.max(1,...H.map(h=>Math.max(h.ent,h.sai,h.saldo)));
  const y=v=>pt+(Ht-pt-pb)*(1-v/max), slot=(W-pl-pr)/n, bw=Math.min(34,slot/3.2);
  let g=`<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Entradas, saídas e saldo do caixa por mês" class="graf">`;
  [0,.5,1].forEach(f=>{const v=max*f,yy=y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" class="gl"/>`});
  const pts=[];
  H.forEach((h,i)=>{const cx=pl+slot*i+slot/2;
    g+=`<rect x="${cx-bw-2}" y="${y(h.ent)}" width="${bw}" height="${y(0)-y(h.ent)}" class="ge"><title>Entradas ${brl(h.ent)}</title></rect>`;
    g+=`<rect x="${cx+2}" y="${y(h.sai)}" width="${bw}" height="${y(0)-y(h.sai)}" class="gs"><title>Saídas ${brl(h.sai)}</title></rect>`;
    g+=`<text x="${cx}" y="${Ht-12}" class="gt" text-anchor="middle">${MESES[+h.m.slice(5)-1].slice(0,3).toLowerCase()}/${h.m.slice(2,4)}</text>`;
    pts.push([cx,y(Math.max(0,h.saldo)),h.saldo]);});
  if(pts.length>1) g+=`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" class="gsl"/>`;
  pts.forEach((p,i)=>{g+=`<circle cx="${p[0]}" cy="${p[1]}" r="${i===pts.length-1?5:3.5}" class="gsp"/>`;if(i===pts.length-1)g+=`<text x="${p[0]}" y="${p[1]-10}" text-anchor="middle" class="gv">${brl(p[2])}</text>`});
  return g+`</svg>`;
}
function situacao(mb){
  const meses=[];for(let m=mb.desde||mesAtual;m<=mesAtual;m=mesAdd(m,1)) if(ativoNo(mb,m)) meses.push(m);
  const prox=mesAdd(mesAtual,1); if(pagDe(mb,prox)) meses.push(prox);
  const linhas=meses.map(m=>{const p=pagDe(mb,m);const st=p?p.status:(vencido(m)?'atrasado':'aberto');return {m,st,valor:p?Number(p.valor):valorPlano(mb),data:p&&p.data}});
  const av=S.avul.filter(a=>a.quem===mb.id).sort((a,b)=>a.data<b.data?1:-1);
  const u=S.uni[mb.id]||{};
  const abertoMens=linhas.filter(l=>l.st==='aberto'||l.st==='atrasado').reduce((x,l)=>x+l.valor,0);
  const abertoAv=av.filter(a=>!a.pago).reduce((x,a)=>x+Number(a.valor),0);
  const abertoUni=u.status==='fechado'?(Number(u.qtd)||0)*Number(S.cfg.uniValor||90):0;
  const fm=frequencia('mes'), fa=frequencia('ano');
  return {linhas,av,u,abertoMens,abertoAv,abertoUni,total:abertoMens+abertoAv+abertoUni,presMes:fm.cont[mb.id]||0,jogosMes:fm.total,presAno:fa.cont[mb.id]||0,jogosAno:fa.total};
}
function renderSituacao(){
  const app=document.getElementById('app');
  if(!(S.ok.m&&S.ok.p&&S.ok.a&&S.ok.u&&S.ok.c&&S.ok.j))return;
  const lista=[...S.membros].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const mb=lista.find(m=>m.id===S.eu);
  let h=`<section class="eu"><label class="f eusel">Quem é você?<select id="euSel" data-act-change="eu"><option value="">Escolha seu nome</option>${lista.map(m=>`<option value="${m.id}"${m.id===S.eu?' selected':''}>${esc(m.nome)}</option>`).join('')}</select></label></section>`;
  if(!mb){h+=`<div class="card"><p class="nota">Escolha seu nome para ver mensalidades, avulsos que você levou, seu pedido do uniforme e sua frequência. Este aparelho lembra a escolha.</p></div>`;app.innerHTML=h;return}
  const x=situacao(mb);
  const STL={pago:['pago','Pago'],isento:['isento','Isento'],aberto:['aberto','Em aberto'],atrasado:['aberto','Atrasado']};
  h+=`<div class="card sit-top"><div><span class="eb">${esc(mb.nome)} · ${planoTxt(mb)}</span>
      ${x.total?`<span class="sit-v due num">${brl(x.total)}</span><span class="nota">em aberto${x.abertoMens?` · mensal ${brl(x.abertoMens)}`:''}${x.abertoAv?` · avulsos ${brl(x.abertoAv)}`:''}${x.abertoUni?` · uniforme ${brl(x.abertoUni)}`:''}</span>`
      :`<span class="sit-v ok">Tudo em dia ✓</span><span class="nota">Nenhum valor em aberto.</span>`}</div></div>`;
  h+=`<section><h2>Mensalidades</h2><div class="lista">${x.linhas.map(l=>`<div class="linha"><div class="lin"><div class="quem"><b>${mesLongo(l.m)}</b><div class="tags"><span class="tag num">${brl(l.valor)}</span></div></div>
      <span class="status ${STL[l.st][0]}">${l.st==='pago'?`✓ Pago ${dataBR(l.data)}`:STL[l.st][1]}</span></div></div>`).join('')||'<div class="vazio">Nenhum mês ainda.</div>'}</div></section>`;
  h+=`<section><h2>Frequência</h2><div class="card freq-eu">
      <div><span class="cn num">${x.presMes}</span><span class="nota">de ${x.jogosMes} jogo${x.jogosMes===1?'':'s'} em ${MESES[+S.mes.slice(5)-1].toLowerCase()}</span></div>
      <div><span class="cn num">${x.presAno}</span><span class="nota">de ${x.jogosAno} jogo${x.jogosAno===1?'':'s'} em ${S.mes.slice(0,4)}</span></div></div></section>`;
  h+=`<section><h2>Avulsos que você levou</h2><div class="card"><div class="avl">${x.av.length?x.av.map(a=>`<div class="it"><span class="qd num">${diaTxt(a.data)}</span><span class="qn"><b>${esc(a.nome)}</b></span>${a.pago?`<span class="status pago">✓ ${brl(a.valor)}</span>`:`<span class="status aberto">${brl(a.valor)}</span>`}</div>`).join(''):'<p class="nota">Nenhum avulso.</p>'}</div></div></section>`;
  const u=x.u, st=u.status||'';
  h+=`<section><h2>Uniforme All Black</h2><div class="card"><div class="ufu">
      <div class="pf"><span>Nome na camisa</span><b>${esc(u.nomeCamisa||'—')}</b></div><div class="pf"><span>Tamanho</span><b>${esc(u.tamanho||'—')}</b></div>
      <div class="pf"><span>Qtd</span><b class="num">${u.qtd||'—'}</b></div>
      <div class="pf"><span>Pagamento</span><span class="status ${st==='pago'?'pago':st==='fechado'?'aberto':'nada'}">${st==='pago'?'Pago':st==='fechado'?'Aguardando Pix':'Não fechou'}</span></div></div>
      ${st!=='pago'?`<p class="nota">Prazo para pagar: ${dataBR(S.cfg.uniPrazo)}/${(S.cfg.uniPrazo||'').slice(0,4)}. Para fechar o pedido, fale com o organizador.</p>`:''}</div></section>`;
  if(x.total&&S.cfg.pix){
    const cod=pixPayload({chave:S.cfg.pix,nome:S.cfg.pixNome,cidade:S.cfg.pixCidade,valor:x.total,txid:'SIT'+mb.id.replace(/[^A-Za-z0-9]/g,'').slice(0,20)}), img=qrImg(cod);
    h+=`<section><h2>Pagar o que está em aberto</h2><div class="card pix"><div class="qrbox">${img?`<img src="${img}" alt="QR code Pix de ${brl(x.total)}">`:''}</div>
      <div class="pixinfo"><div><div class="rot">Valor</div><div><b class="num">${brl(x.total)}</b></div></div><div><div class="rot">Chave Pix (e-mail)</div><div class="chave">${esc(S.cfg.pix)}</div></div>
      <div><div class="rot">Pix copia e cola</div><p class="cc" id="ccTxt">${esc(cod)}</p></div>
      <div class="linhab"><button class="btn prim" data-act="copiarCC">Copiar código</button><button class="btn sec" data-act="copiarChave">Copiar chave</button></div>
      <p class="nota">Depois de pagar, mande o comprovante para o organizador dar baixa.</p></div></div></section>`;
  }
  app.innerHTML=h;
}

function msgPresenca(t){
  const iso=jogoAtual(), d=dow(iso), pr=presentes(iso).map(nomeMb).sort((a,b)=>a.localeCompare(b,'pt-BR')), min=minDe(iso);
  const avs=S.avul.filter(a=>a.data===iso);
  if(cancelado(iso)) return `❌ *Jogo cancelado · ${DIA_LONGO[d]} ${dataBR(iso)} · ${HORA[d]}*\nMotivo: ${S.jogos[iso].motivo||'não informado'}\n\nNos vemos no próximo jogo!`;
  let s=`*${DIA_LONGO[d]} ${dataBR(iso)} · ${HORA[d]}*\nFutevôlei Zero11 · Rua Saldanha de Oliveira, 60\n\n✅ Confirmados (${pr.length})\n`+(pr.length?pr.map(n=>`• ${n}`).join('\n'):'• ninguém confirmou ainda');
  if(avs.length) s+=`\n\n🎟️ Avulsos (${avs.length})\n`+avs.map(a=>`• ${a.nome} (levado por ${nomeMb(a.quem)})`).join('\n');
  s+=`\n\n`+(pr.length<min?`Com ${pr.length} confirmados (menos de ${min}), *vaga liberada para avulso*. Valor fixo de ${brl(S.cfg.valorAvulso)}, pago por quem levar.`:`${pr.length} confirmados: *sem vaga para avulso* neste jogo.`);
  return s;
}
function msgFechamento(t){
  const dm=S.desp.filter(d=>d.mes===S.mes);
  const res=t.recebido+t.avPago-t.despMes, anterior=t.caixa-res;
  const pend=t.ativos.filter(mb=>!pagDe(mb,S.mes)).map(mb=>mb.nome).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const avp=t.avMes.filter(a=>!a.pago);
  let s=`*Fechamento · ${mesLongo(S.mes)}*\nMensal Futvôlei 100 Compromisso\n\n💵 *Entradas*\n• Mensalidades: ${brl(t.recebido)} (${t.pagos} de ${t.ativos.length-t.isentos})\n• Avulsos: ${brl(t.avPago)} (${t.avMes.filter(a=>a.pago).length})\nTotal: ${brl(t.recebido+t.avPago)}\n\n🧾 *Saídas*\n`;
  s+=(dm.length?dm.map(d=>`• ${d.descricao}: ${brl(d.valor)}`).join('\n'):'• nenhuma')+`\nTotal: ${brl(t.despMes)}\n\n`;
  s+=`📊 Resultado do mês: ${res<0?'-':''}${brl(Math.abs(res))}\nSaldo anterior: ${brl(anterior)}\n💰 *Caixa: ${brl(t.caixa)}*`;
  if(pend.length||avp.length){s+=`\n\n⏳ Em aberto\n`+[...pend.map(n=>`• ${n}`),...avp.map(a=>`• Avulso ${a.nome} (${nomeMb(a.quem)}) – ${brl(a.valor)}`)].join('\n')}
  else s+=`\n\nTodo mundo em dia. Valeu, galera! 🙌`;
  return s;
}
function msgCobranca(t){
  const pend=t.ativos.filter(mb=>!pagDe(mb,S.mes)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const ok=t.ativos.filter(mb=>pagDe(mb,S.mes)?.status==='pago').sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  let s=`*Mensal Futvôlei 100 Compromisso · ${mesLongo(S.mes)}*\n\n`;
  s+=`Ter + Sáb: ${brl(S.cfg.valor2x)} · Só sábado: ${brl(S.cfg.valor1x)}\n`;
  s+=`Cobrança: dia ${pad(S.cfg.cobranca||1)} · Pagamento até: ${prazoTxt(S.mes)}\n`;
  if(S.cfg.pix) s+=`Pix: ${S.cfg.pix}\n`;
  s+=`\n✅ Pagos (${ok.length})\n`+(ok.length?ok.map(mb=>`• ${mb.nome}`).join('\n'):'• ninguém ainda');
  s+=`\n\n${vencido(S.mes)&&pend.length?'⚠️ Atrasados':'⏳ Falta pagar'} (${pend.length})\n`+(pend.length?pend.map(mb=>`• ${mb.nome} – ${brl(valorPlano(mb))}`).join('\n'):'• ninguém, todo mundo em dia! 🙌');
  const avp=t.avMes.filter(a=>!a.pago);
  if(avp.length){
    const porResp={};avp.forEach(a=>{(porResp[a.quem]=porResp[a.quem]||[]).push(a)});
    s+=`\n\n🎟️ Avulsos a pagar (${brl(S.cfg.valorAvulso)} cada)\n`+Object.entries(porResp).sort((a,b)=>nomeMb(a[0]).localeCompare(nomeMb(b[0]),'pt-BR'))
      .map(([q,l])=>`• ${nomeMb(q)} – ${brl(l.reduce((x,a)=>x+Number(a.valor),0))} (${l.map(a=>`${a.nome}, ${DSEM[dow(a.data)]} ${dataBR(a.data)}`).join('; ')})`).join('\n');
  }
  return s;
}

const TAMANHOS=['PP','P','M','G','GG','XGG','BL P','BL M','BL G','BL GG'];
function linhasUni(){
  const mbs=S.membros.filter(mb=>ativoNo(mb,mesAtual)).map(mb=>({id:mb.id,nome:mb.nome,externo:false,...(S.uni[mb.id]||{})}));
  const ext=Object.entries(S.uni).filter(([id,u])=>u.externo).map(([id,u])=>({id,...u}));
  return [...mbs,...ext].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
function totaisUni(){
  const L=linhasUni(); let pagos=0,fechados=0;const grade={};
  L.forEach(u=>{const q=Number(u.qtd)||0; if(u.status==='pago')pagos+=q; if(u.status==='fechado')fechados+=q;
    if((u.status==='pago'||u.status==='fechado')&&q){const k=u.tamanho||'sem tamanho';grade[k]=(grade[k]||0)+q}});
  return {L,pagos,fechados,meta:Number(S.cfg.uniMeta||10),valor:Number(S.cfg.uniValor||90),grade};
}
function msgUniforme(T){
  const pg=T.L.filter(u=>u.status==='pago'), fc=T.L.filter(u=>u.status==='fechado');
  const kit=u=>`${u.qtd} kit${u.qtd>1?'s':''}${u.tamanho?`, ${u.tamanho}`:''}${u.nomeCamisa?`, "${u.nomeCamisa}"`:''}`;
  let s=`*Uniforme All Black · 100 Compromisso*\nKit camisa + bermuda: ${brl(T.valor)}\nMínimo para produzir: ${T.meta} kits\n📅 Pagamento até: ${dataBR(S.cfg.uniPrazo||'')}/${(S.cfg.uniPrazo||'').slice(0,4)}\nPix: ${S.cfg.pix}\n\n✅ Pagos (${T.pagos} kit${T.pagos===1?'':'s'})\n`+(pg.length?pg.map(u=>`• ${u.nome} – ${kit(u)}`).join('\n'):'• ninguém ainda');
  if(fc.length) s+=`\n\n⏳ Fechou, falta o Pix (${T.fechados})\n`+fc.map(u=>`• ${u.nome} – ${kit(u)} = ${brl(u.qtd*T.valor)}`).join('\n');
  const falta=T.meta-T.pagos;
  s+=`\n\n`+(falta>0?`Faltam *${falta} kit${falta>1?'s':''} pagos* para mandar produzir! Quem ainda não fechou, chama no privado.`:`🔥 Meta batida! ${T.pagos} kits pagos, vamos para a produção.`);
  return s;
}
function renderUniforme(){
  const app=document.getElementById('app');
  if(S.semDb){app.innerHTML=`<div class="aviso">Não consegui abrir os dados. Confira sua internet e recarregue a página.</div>`;return}
  if(!(S.ok.m&&S.ok.u&&S.ok.c))return;
  const T=totaisUni();
  const pP=Math.min(100,T.pagos/T.meta*100), pF=Math.min(100-pP,T.fechados/T.meta*100), falta=Math.max(0,T.meta-T.pagos);
  const pagosNomes=T.L.filter(u=>u.status==='pago');
  let h=`<figure class="uhero"><img src="img/uniforme-all-black.jpg" alt="Uniforme All Black: camisa preta com faixa vertical cinza e o 100 Compromisso Cup na frente, punhos cinza, costas lisas com 100 Compromisso Cup no alto, e bermuda preta com o escudo" width="1254" height="1254">
    <figcaption><span class="eb">Uniforme escolhido</span><b>All Black</b><span>Kit camisa + bermuda · <strong class="num">${brl(T.valor)}</strong>${S.cfg.uniPrazo?` · pagamento até ${dataBR(S.cfg.uniPrazo)}`:''}</span></figcaption></figure>`;
  h+=`<div class="card meta">
    <div class="metah"><div><span class="cn num">${T.pagos}</span><span class="de">de ${T.meta} kits pagos</span></div>
      <div class="arr"><span class="eb">Arrecadado</span><b class="num">${brl(T.pagos*T.valor)}</b><small class="num">meta ${brl(T.meta*T.valor)}</small></div></div>
    <div class="ubar" role="progressbar" aria-valuemin="0" aria-valuemax="${T.meta}" aria-valuenow="${T.pagos}" aria-label="Kits pagos">
      <i class="pg" style="width:${pP}%"></i><i class="fc" style="width:${pF}%"></i>
      ${Array.from({length:T.meta-1},(_,i)=>`<span class="tick" style="left:${(i+1)/T.meta*100}%"></span>`).join('')}
    </div>
    ${(()=>{const pz=S.cfg.uniPrazo;if(!pz)return'';const dias=Math.round((new Date(pz+'T23:59:59')-hojeD)/864e5);const dt=`${dataBR(pz)}/${pz.slice(0,4)}`;
      return `<div class="prazo ${dias<0?'fim':dias<=3?'perto':''}"><span class="eb">Prazo para pagamento</span><b class="num">${dt}</b><span>${dias<0?'Prazo encerrado':dias===0?'Último dia!':`Faltam ${dias} dia${dias>1?'s':''}`}</span></div>`})()}
    <div class="leg"><span><i class="sw pg"></i>Pago</span><span><i class="sw fc"></i>Fechou, falta o Pix (${T.fechados})</span>
      <span class="fim">${falta?`Faltam <b>${falta}</b> para produzir`:'<b>Meta batida!</b> Pode produzir'}</span></div>
    ${pagosNomes.length?`<div class="quem-pagou">${pagosNomes.map(u=>`<span>✓ ${esc(u.nome)}${u.qtd>1?` ×${u.qtd}`:''}</span>`).join('')}</div>`:''}
  </div>`;
  h+=`<section><div class="sech"><h2>Pedidos</h2><span class="nota">${S.pode?'Preencha ao lado de cada nome. Salva sozinho.':''}</span></div><div class="ped">
    <div class="ped-cab" aria-hidden="true"><span>Integrante</span><span>Nome na camisa</span><span>Tamanho</span><span>Qtd</span><span>Status de pagamento</span></div>`;
  T.L.forEach(u=>{
    const st=u.status||'';
    const stTxt={'':'Não fechou',fechado:'Aguardando Pix',pago:'Pago'}[st];
    h+=`<div class="prow st-${st||'nada'}"><div class="pn"><b>${esc(u.nome)}</b>${u.externo?'<small>convidado</small>':''}${u.externo&&S.pode?`<button class="x" data-act="delUni" data-id="${u.id}" aria-label="Remover ${esc(u.nome)}">×</button>`:''}</div>`;
    if(S.pode){
      h+=`<label class="pf"><span>Nome na camisa</span><input data-uf="nomeCamisa" data-id="${u.id}" id="uf-n-${u.id}" value="${esc(u.nomeCamisa||'')}" maxlength="14" placeholder="${esc(u.nome.split(' ')[0].toUpperCase())}"></label>
        <label class="pf"><span>Tamanho</span><select data-uf="tamanho" data-id="${u.id}" id="uf-t-${u.id}"><option value="">—</option>${TAMANHOS.map(t=>`<option${u.tamanho===t?' selected':''}>${t}</option>`).join('')}</select></label>
        <label class="pf"><span>Qtd</span><input data-uf="qtd" data-id="${u.id}" id="uf-q-${u.id}" type="number" min="0" max="10" inputmode="numeric" value="${u.qtd??''}" placeholder="0"></label>
        <label class="pf"><span>Status de pagamento</span><select data-uf="status" data-id="${u.id}" id="uf-s-${u.id}" class="sel-${st||'nada'}">
          <option value=""${st===''?' selected':''}>Não fechou</option><option value="fechado"${st==='fechado'?' selected':''}>Aguardando Pix</option><option value="pago"${st==='pago'?' selected':''}>Pago</option></select></label>`;
    } else {
      h+=`<div class="pf"><span>Nome na camisa</span><b>${esc(u.nomeCamisa||'—')}</b></div><div class="pf"><span>Tamanho</span><b>${esc(u.tamanho||'—')}</b></div>
        <div class="pf"><span>Qtd</span><b class="num">${u.qtd||'—'}</b></div><div class="pf"><span>Status de pagamento</span><span class="status ${st==='pago'?'pago':st==='fechado'?'aberto':'nada'}">${stTxt}</span></div>`;
    }
    h+=`</div>`;
  });
  h+=`</div>`;
  if(S.pode) h+=`<form class="inline" id="fExt"><input id="eNome" required maxlength="40" placeholder="Pedido de alguém de fora do mensal"><button class="btn sec" type="submit">Adicionar</button></form>`;
  h+=`</section>`;
  const gk=Object.keys(T.grade).sort((a,b)=>TAMANHOS.indexOf(a)-TAMANHOS.indexOf(b));
  h+=`<section><h2>Grade para a fábrica</h2><div class="card"><div class="grade-t">${gk.length?gk.map(k=>`<div><span>${esc(k)}</span><b class="num">${T.grade[k]}</b></div>`).join(''):'<p class="nota">Os tamanhos aparecem aqui quando alguém fechar o pedido.</p>'}</div>
    ${gk.length?`<p class="nota">Conta os pedidos pagos e os que aguardam Pix · total ${T.pagos+T.fechados} kits.</p>`:''}</div></section>`;
  if(S.cfg.pix){
    const v=S.uniPix*T.valor, cod=pixPayload({chave:S.cfg.pix,nome:S.cfg.pixNome,cidade:S.cfg.pixCidade,valor:v,txid:'UNIFORME'}), img=qrImg(cod);
    h+=`<section><div class="sech"><h2>Pagar o uniforme</h2><div class="chips">${[1,2,3].map(n=>`<button class="chip" data-act="uniPix" data-v="${n}" aria-pressed="${S.uniPix===n}">${n} kit${n>1?'s':''} · ${brl(n*T.valor)}</button>`).join('')}</div></div>
    <div class="card pix"><div class="qrbox">${img?`<img src="${img}" alt="QR code Pix do uniforme, ${brl(v)}">`:''}</div>
      <div class="pixinfo"><div><div class="rot">Chave Pix (e-mail)</div><div class="chave">${esc(S.cfg.pix)}</div></div>
        <div><div class="rot">Valor</div><div><b class="num">${brl(v)}</b> · ${S.uniPix} kit${S.uniPix>1?'s':''} All Black</div></div>
        <div><div class="rot">Pix copia e cola</div><p class="cc" id="ccTxt">${esc(cod)}</p></div>
        <div class="linhab"><button class="btn prim" data-act="copiarCC">Copiar código</button><button class="btn sec" data-act="copiarChave">Copiar chave</button></div></div></div></section>`;
  }
  const msg=msgUniforme(T);
  h+=`<section><h2>Mensagem para o grupo</h2><div class="card"><pre class="msg" id="msgTxt">${esc(msg)}</pre>
    <div class="linhab"><button class="btn prim" data-act="copiar">Copiar mensagem</button><a class="btn sec" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Abrir no WhatsApp</a></div></div></section>`;
  if(S.pode) h+=`<details class="aj"><summary>Valor e meta</summary><div class="ajc"><form class="ajb" id="fUniCfg"><div class="grade">
      <label class="f">Valor do kit (R$)<input id="uV" type="number" step="0.01" min="0" value="${T.valor}"></label>
      <label class="f">Mínimo de kits<input id="uM" type="number" min="1" max="200" value="${T.meta}"></label>
      <label class="f" style="grid-column:1/-1">Prazo para pagamento<input id="uP" type="date" value="${S.cfg.uniPrazo||''}"></label></div>
      <div><button class="btn prim" type="submit">Salvar</button></div></form></div></details>`;
  app.innerHTML=h;
}

function render(){
  const ae=document.activeElement;
  if(ae&&ae.closest&&ae.closest('#app')&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)){S.pend=true;return}
  S.pend=false;
  document.querySelectorAll('.abas button').forEach(b=>{if(b.dataset.v===S.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  document.getElementById('mesnavBox').hidden=S.view!=='mensal';
  document.getElementById('infoBox').hidden=S.view!=='mensal';
  document.querySelector('.marca h1').textContent=S.view==='uniforme'?'Uniforme 100 Compromisso':'Mensal 100 Compromisso';
  if(S.view==='uniforme'){renderUniforme();return}
  if(S.view==='situacao'){renderSituacao();return}
  document.getElementById('mesNome').textContent=mesLongo(S.mes);
  document.getElementById('mesSub').textContent=`cobrança dia ${pad(S.cfg.cobranca||1)} · pagar até ${prazoTxt(S.mes)}`;
  const app=document.getElementById('app');
  if(S.semDb){app.innerHTML=`<div class="aviso">Não consegui abrir os dados do mensal. Confira sua internet e recarregue a página.</div>`;return}
  if(!(S.ok.m&&S.ok.p&&S.ok.d&&S.ok.a&&S.ok.j)){return}
  const t=totais();
  const pct=t.previsto?Math.round(t.recebido/t.previsto*100):0;
  let lista=[...t.ativos].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(S.filtro==='falta') lista=lista.filter(mb=>!pagDe(mb,S.mes));
  if(S.filtro==='pagos') lista=lista.filter(mb=>pagDe(mb,S.mes));
  const nFalta=t.ativos.length-t.pagos-t.isentos;

  let h=`<div class="resumo">
    <div class="kpi"><span class="rot">Previsto</span><span class="v num">${brl(t.previsto)}</span><span class="sub">${t.ativos.length} integrantes</span></div>
    <div class="kpi rec"><span class="rot">Recebido</span><span class="v num">${brl(t.recebido)}</span><span class="sub">${t.pagos} pagaram</span></div>
    <div class="kpi falta"><span class="rot">Falta receber</span><span class="v num">${brl(t.falta)}</span><span class="sub">${nFalta} ${vencido(S.mes)?'atrasado'+(nFalta===1?'':'s'):'em aberto'}</span></div>
    <div class="kpi caixa"><span class="rot">Caixa</span><span class="v num">${brl(t.caixa)}</span><span class="sub">saldo até ${MESES[+S.mes.slice(5)-1].toLowerCase()}</span></div>
    <div class="barra"><div class="trilho" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <p><b class="num">${pct}%</b> arrecadado · avulsos <b class="num">${brl(t.avPago)}</b> · despesas <b class="num">${brl(t.despMes)}</b> · sobra do mês <b class="num">${brl(t.recebido+t.avPago-t.despMes)}</b></p></div>
  </div>`;

  { const js=jogosDoMes(S.mes), iso=jogoAtual(), d=dow(iso), pr=presentes(iso), min=minDe(iso), avs=S.avul.filter(a=>a.data===iso);
    const vaga=pr.length<min, canc=cancelado(iso), jg=S.jogos[iso]||{};
    h+=`<section><div class="sech"><h2>Presença</h2><span class="nota">${js.length} jogos no mês</span></div>
    <div class="jogos" role="group" aria-label="Escolher jogo">${js.map(j=>`<button class="chip jg${j<hojeISO?' passado':''}${cancelado(j)?' canc':''}" data-act="jogo" data-v="${j}" aria-pressed="${j===iso}"><small>${DSEM[dow(j)]}</small>${j.slice(8)}</button>`).join('')}</div>
    <div class="card pres">
      <div class="presh"><div><span class="pd">${DIA_LONGO[d]} ${dataBR(iso)}</span><span class="ph num">${HORA[d]}</span></div>
        <div class="contagem"><span class="cn num">${pr.length}</span><span>confirmado${pr.length===1?'':'s'}${avs.length?` + ${avs.length} avulso${avs.length>1?'s':''}`:''}</span></div></div>
      ${canc?`<div class="vaga canc">Jogo cancelado · ${esc(jg.motivo||'sem motivo')}</div>${S.pode?`<div><button class="btn sec" data-act="descancelar">Desfazer cancelamento</button></div>`:''}`:`
      <div class="vaga ${vaga?'sim':'nao'}">${vaga?`Vaga para avulso liberada · menos de ${min} confirmados`:`Sem vaga para avulso · ${min} ou mais confirmados`}</div>
      ${S.pode?`<div class="pgrid">${[...t.ativos].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(mb=>`<button class="pchip" data-act="pres" data-id="${mb.id}" aria-pressed="${pr.includes(mb.id)}">${esc(mb.nome)}${mb.plano==='1x'&&d===2?'<small>só sáb</small>':''}</button>`).join('')}</div><p class="nota">Toque no nome para marcar quem confirmou.</p>`
      :`<p class="nota">${pr.length?pr.map(nomeMb).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(esc).join(' · '):'Ninguém confirmou ainda.'}</p>`}
      ${avs.length?`<p class="nota">Avulsos: ${avs.map(a=>`${esc(a.nome)} (${esc(nomeMb(a.quem))})`).join(' · ')}</p>`:''}
      ${S.pode?`<details class="cancela"><summary>Cancelar este jogo</summary><div class="chips">${MOTIVOS.map(m=>`<button class="chip" data-act="cancelar" data-v="${m}">${m}</button>`).join('')}</div></details>`:''}`}
    </div></section>`;
  }

  h+=`<section><div class="sech"><h2>Integrantes</h2><div class="chips">
    ${[['todos','Todos'],['falta','Falta pagar'],['pagos','Pagos']].map(([k,l])=>`<button class="chip" data-act="filtro" data-v="${k}" aria-pressed="${S.filtro===k}">${l}</button>`).join('')}
  </div></div><div class="lista">`;
  if(!t.ativos.length) h+=`<div class="vazio">Nenhum integrante neste mês.${S.pode?(S.membros.length?' Adicione em Ajustes, lá embaixo.':' <br><br><button class="btn prim" data-act="importarInicial">Importar os dados atuais do mensal</button>'):''}</div>`;
  else if(!lista.length) h+=`<div class="vazio">${S.filtro==='falta'?'Todo mundo pagou este mês. 🙌':'Ninguém pagou ainda este mês.'}</div>`;
  lista.forEach(mb=>{
    const p=pagDe(mb,S.mes); const atr=atrasos(mb);
    let dir;
    if(p&&p.status==='pago') dir=`<span class="status pago">✓ Pago ${dataBR(p.data)}</span>`;
    else if(p&&p.status==='isento') dir=`<span class="status isento">Isento</span>`;
    else dir=S.pode?`<button class="btn prim" data-act="pagar" data-id="${mb.id}">Recebi ${brl(valorPlano(mb))}</button>`:`<span class="status aberto">${vencido(S.mes)?'Atrasado':'Em aberto'}</span>`;
    const atrTag=atr.length?`<span class="tag atraso">+ ${atr.length} ${atr.length>1?'meses':'mês'} em aberto (${atr.map(m=>MESES[+m.slice(5)-1].slice(0,3).toLowerCase()).join(', ')})</span>`:'';
    const ab=S.aberto===mb.id;
    h+=`<div class="linha"><div class="lin"><div class="quem"><b>${esc(mb.nome)}</b><div class="tags"><span class="tag">${planoTxt(mb)}</span>${p&&p.status==='pago'&&Number(p.valor)!==valorPlano(mb)?`<span class="tag">pagou ${brl(p.valor)}</span>`:''}${!p&&vencido(S.mes)?'<span class="tag atraso">atrasado</span>':''}${atrTag}</div></div>
      <div class="acoes">${dir}${S.pode?`<button class="mais" data-act="abrir" data-id="${mb.id}" aria-expanded="${ab}" aria-label="Mais opções para ${esc(mb.nome)}">⋯</button>`:''}</div></div>`;
    if(ab&&S.pode){
      h+=`<div class="painel">`;
      if(p) h+=`<button class="btn sec" data-act="desfazer" data-id="${mb.id}">Desfazer ${p.status==='pago'?'pagamento':'isenção'}</button>`;
      else h+=`<button class="btn sec" data-act="isentar" data-id="${mb.id}">Isentar este mês</button>`;
      h+=`<button class="btn sec" data-act="plano" data-id="${mb.id}">Mudar para ${mb.plano==='1x'?'Ter + Sáb':'só sábado'}</button>`;
      atr.forEach(m=>{h+=`<button class="btn sec" data-act="pagarAtr" data-id="${mb.id}" data-m="${m}">Recebi ${MESES[+m.slice(5)-1].toLowerCase()}</button>`});
      h+=`<button class="btn sec" data-act="sair" data-id="${mb.id}">Saiu do grupo</button></div>`;
    }
    h+=`</div>`;
  });
  h+=`</div></section>`;

  if(S.cfg.pix){
    const valor=S.qrPlano==='1x'?S.cfg.valor1x:S.qrPlano==='2x'?S.cfg.valor2x:0;
    const cod=pixPayload({chave:S.cfg.pix,nome:S.cfg.pixNome,cidade:S.cfg.pixCidade,valor,txid:'MENSAL'+S.mes.replace('-','')});
    const img=qrImg(cod);
    h+=`<section><div class="sech"><h2>Pagar com Pix</h2><div class="chips">
      ${[['2x',`Ter + Sáb · ${brl(S.cfg.valor2x)}`],['1x',`Sáb · ${brl(S.cfg.valor1x)}`],['livre','Outro valor']].map(([k,l])=>`<button class="chip" data-act="qr" data-v="${k}" aria-pressed="${S.qrPlano===k}">${l}</button>`).join('')}
    </div></div><div class="card pix">
      <div class="qrbox">${img?`<img src="${img}" alt="QR code Pix ${valor?brl(valor):'sem valor definido'}">`:''}</div>
      <div class="pixinfo">
        <div><div class="rot">Chave Pix (e-mail)</div><div class="chave">${esc(S.cfg.pix)}</div></div>
        <div><div class="rot">Recebedor</div><div>${esc(S.cfg.pixNome)} · ${valor?`<b class="num">${brl(valor)}</b>`:'valor digitado no app do banco'}</div></div>
        <div><div class="rot">Pix copia e cola</div><p class="cc" id="ccTxt">${esc(cod)}</p></div>
        <div class="linhab"><button class="btn prim" data-act="copiarCC">Copiar código</button><button class="btn sec" data-act="copiarChave">Copiar chave</button></div>
      </div></div></section>`;
  }
  const msg=S.msgTipo==='fechamento'?msgFechamento(t):S.msgTipo==='presenca'?msgPresenca(t):msgCobranca(t);
  h+=`<section><div class="sech"><h2>Mensagens para o grupo</h2><div class="chips">${[['cobranca','Cobrança'],['presenca','Lista do jogo'],['fechamento','Fechamento do mês']].map(([k,l])=>`<button class="chip" data-act="msg" data-v="${k}" aria-pressed="${S.msgTipo===k}">${l}</button>`).join('')}</div></div>
  <div class="card"><pre class="msg" id="msgTxt">${esc(msg)}</pre>
    <div class="linhab"><button class="btn prim" data-act="copiar">Copiar mensagem</button>
    <a class="btn sec" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Abrir no WhatsApp</a></div></div></section>`;

  const av=[...t.avMes].sort((a,b)=>a.data<b.data?1:a.data>b.data?-1:0);
  h+=`<section><div class="sech"><h2>Avulsos do mês</h2><span class="nota num">${av.length} · recebido ${brl(t.avPago)}${t.avAberto?` · a receber ${brl(t.avAberto)}`:''}</span></div><div class="card"><div class="avl">`;
  if(!av.length) h+=`<p class="nota">Nenhum avulso neste mês. Cada avulso paga ${brl(S.cfg.valorAvulso)}, e quem levou responde pelo pagamento.</p>`;
  av.forEach(a=>{h+=`<div class="it"><span class="qd num">${diaTxt(a.data)}</span><span class="qn"><b>${esc(a.nome)}</b><small>levado por ${esc(nomeMb(a.quem))}</small></span>
    ${a.pago?`<span class="status pago">✓ ${brl(a.valor)}</span>`:(S.pode?`<button class="btn prim" data-act="avPagar" data-id="${a.id}">Recebi ${brl(a.valor)}</button>`:`<span class="status aberto">${brl(a.valor)}</span>`)}
    ${S.pode?`<button class="x" data-act="delAv" data-id="${a.id}" aria-label="Apagar avulso ${esc(a.nome)}">×</button>`:''}</div>`});
  h+=`</div>`;
  if(S.pode){
    const opts=[...t.ativos].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(mb=>`<option value="${mb.id}">${esc(mb.nome)}</option>`).join('');
    const ini=jogoAtual();
    h+=`<form class="avf" id="fAv"><div class="grade">
      <label class="f">Dia do jogo<input id="aData" type="date" value="${ini}" min="${S.mes}-01" max="${S.mes}-31" required></label>
      <label class="f">Nome do avulso<input id="aNome" required maxlength="40" placeholder="Ex.: Carlos"></label>
      <label class="f">Quem levou<select id="aQuem" required><option value="">Escolha</option>${opts}</select></label>
      <label class="f">Pagamento<select id="aPago"><option value="1">Já pagou</option><option value="0">Ainda não</option></select></label>
    </div><div><button class="btn prim" type="submit">Lançar avulso · ${brl(S.cfg.valorAvulso)}</button></div></form>`;
  }
  h+=`</div></section>`;

  { const F=frequencia(S.freqPer); const ativosF=[...t.ativos].map(mb=>({mb,n:F.cont[mb.id]||0})).sort((a,b)=>b.n-a.n||a.mb.nome.localeCompare(b.mb.nome,'pt-BR'));
    const mx=Math.max(1,...ativosF.map(a=>a.n));
    h+=`<section><div class="sech"><h2>Frequência</h2><div class="chips">${[['mes',MESES[+S.mes.slice(5)-1]],['ano',S.mes.slice(0,4)]].map(([k,l])=>`<button class="chip" data-act="freq" data-v="${k}" aria-pressed="${S.freqPer===k}">${l}</button>`).join('')}</div></div>
    <div class="card"><p class="nota">${F.total} jogo${F.total===1?'':'s'} com presença marcada${F.total?'':'. A frequência aparece quando você marcar quem foi em cada jogo.'}</p>
    ${F.total?`<div class="freq">${ativosF.map((a,i)=>`<div class="fr"><span class="fp num">${a.n&&(i===0||a.n!==ativosF[i-1].n)?i+1+'º':''}</span><span class="fn">${esc(a.mb.nome)}</span><span class="fb"><i style="width:${a.n/mx*100}%"></i></span><span class="fv num">${a.n}/${F.total}</span></div>`).join('')}</div>`:''}</div></section>`;
  }

  const dm=S.desp.filter(d=>d.mes===S.mes);
  h+=`<section><div class="sech"><h2>Despesas do mês</h2><span class="nota num">${brl(t.despMes)}</span></div><div class="card"><div class="desp">`;
  if(!dm.length) h+=`<p class="nota">Nenhuma despesa lançada. Ex.: aluguel da quadra, bola, rede.</p>`;
  dm.forEach(d=>{h+=`<div class="it"><span>${esc(d.descricao)}</span><span class="num">${brl(d.valor)}</span>${S.pode?`<button class="x" data-act="delDesp" data-id="${d.id}" aria-label="Apagar ${esc(d.descricao)}">×</button>`:'<span></span>'}</div>`});
  h+=`</div>`;
  if(S.pode) h+=`<form class="inline" id="fDesp"><input id="dDesc" placeholder="Descrição" required maxlength="60"><input id="dVal" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Valor" required><button class="btn prim" type="submit">Lançar</button></form>`;
  h+=`</div></section>`;

  { const HC=historicoCaixa();
    h+=`<section><h2>Histórico do caixa</h2><div class="card">${graficoCaixa(HC)}
      <div class="gleg"><span><i class="sw ge"></i>Entradas</span><span><i class="sw gs"></i>Saídas</span><span><i class="sw gsl"></i>Saldo</span></div>
      <div class="htab"><table><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>
      <tr><td>Saldo anterior</td><td></td><td></td><td class="num">${brl(S.cfg.saldoInicial||0)}</td></tr>
      ${HC.map(h=>`<tr><td>${mesLongo(h.m)}</td><td class="num">${brl(h.ent)}</td><td class="num">${brl(h.sai)}</td><td class="num"><b>${brl(h.saldo)}</b></td></tr>`).join('')}</tbody></table></div></div></section>`;
  }

  if(S.pode){
    const inat=S.membros.filter(mb=>!ativoNo(mb,S.mes)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    h+=`<details class="aj" id="ajustes"><summary>Ajustes</summary><div class="ajc">
      <form class="ajb" id="fCfg"><h3>Valores e Pix</h3><div class="grade">
        <label class="f">Ter + Sáb (R$)<input id="cV2" type="number" step="0.01" min="0" value="${S.cfg.valor2x}"></label>
        <label class="f">Só sábado (R$)<input id="cV1" type="number" step="0.01" min="0" value="${S.cfg.valor1x}"></label>
        <label class="f">Dia da cobrança<input id="cCob" type="number" min="1" max="28" value="${S.cfg.cobranca||1}"></label>
        <label class="f">Pagar até o dia<input id="cVenc" type="number" min="1" max="28" value="${S.cfg.vencimento||10}"></label>
        <label class="f">Avulso no sábado: abaixo de<input id="cMinS" type="number" min="1" max="40" value="${S.cfg.minSab||10}"></label>
        <label class="f">Avulso na terça: abaixo de<input id="cMinT" type="number" min="1" max="40" value="${S.cfg.minTer||8}"></label>
        <label class="f">Avulso (R$)<input id="cAv" type="number" step="0.01" min="0" value="${S.cfg.valorAvulso||20}"></label>
        <label class="f">Saldo inicial do caixa (R$)<input id="cSaldo" type="number" step="0.01" value="${S.cfg.saldoInicial||0}"></label>
      </div><label class="f">Chave Pix<input id="cPix" value="${esc(S.cfg.pix)}" placeholder="celular, e-mail ou chave aleatória" maxlength="80"></label>
      <div class="grade"><label class="f">Nome do recebedor<input id="cPixNome" value="${esc(S.cfg.pixNome)}" maxlength="25"></label>
      <label class="f">Cidade<input id="cPixCid" value="${esc(S.cfg.pixCidade)}" maxlength="15"></label></div>
      <p class="nota">Mudar o valor vale para os meses ainda não pagos. O que já foi recebido fica como está.</p>
      <div><button class="btn prim" type="submit">Salvar ajustes</button></div></form>
      <form class="ajb" id="fNovo"><h3>Novo integrante</h3><div class="grade">
        <label class="f">Nome<input id="nNome" required maxlength="40"></label>
        <label class="f">Joga<select id="nPlano"><option value="2x">Ter + Sáb</option><option value="1x">Só sábado</option></select></label></div>
        <p class="nota">Entra a partir de ${mesLongo(S.mes).toLowerCase()}.</p>
        <div><button class="btn prim" type="submit">Adicionar</button></div></form>
      ${inat.length?`<div class="ajb"><h3>Fora do grupo neste mês</h3>${inat.map(mb=>`<div class="inat"><span>${esc(mb.nome)}</span><button class="btn sec" data-act="voltar" data-id="${mb.id}">Voltar em ${MESES[+S.mes.slice(5)-1].toLowerCase()}</button></div>`).join('')}</div>`:''}
      <div class="ajb"><h3>Backup</h3><p class="nota">Baixe uma cópia de tudo de vez em quando. Para restaurar, escolha um arquivo de backup: ele regrava os dados.</p>
        <div class="linhab"><button class="btn sec" type="button" data-act="backup">Baixar backup</button><label class="btn sec" for="impArq" style="cursor:pointer">Restaurar backup</label><input id="impArq" type="file" accept="application/json,.json" hidden></div></div>
    </div></details>`;
  }
  const abertoAj=document.getElementById('ajustes')?.open;
  app.innerHTML=h;
  if(abertoAj&&document.getElementById('ajustes')) document.getElementById('ajustes').open=true;
}

async function grava(fn,ok){
  try{await fn(); if(ok) toast(ok)}
  catch(e){
    if(e&&(e.code==='invalid_argument'||e.code==='permission-denied')&&S.pode){S.pode=false;render();toast('Você só pode ver este mensal. Quem altera é o organizador.')}
    else if(e&&e.code==='quota_exceeded') toast('O espaço de dados acabou. Apague despesas antigas.');
    else toast('Não salvou. Confira a internet e tente de novo.');
  }
}

document.getElementById('mesAnt').onclick=()=>{S.mes=mesAdd(S.mes,-1);S.aberto=null;S.jogoSel=null;render()};
document.getElementById('mesProx').onclick=()=>{S.mes=mesAdd(S.mes,1);S.aberto=null;S.jogoSel=null;render()};

document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-act]'); if(!b) return;
  const act=b.dataset.act, id=b.dataset.id, mb=S.membros.find(x=>x.id===id), db=S.db;
  if(act==='filtro'){S.filtro=b.dataset.v;try{localStorage.setItem('mensal_filtro',S.filtro)}catch(e){};render();return}
  if(act==='view'){S.view=b.dataset.v;try{history.replaceState(null,'',S.view==='mensal'?'#':'#'+S.view)}catch(e){};render();scrollTo(0,0);return}
  if(act==='uniPix'){S.uniPix=Number(b.dataset.v);render();return}
  if(act==='freq'){S.freqPer=b.dataset.v;render();return}
  if(act==='jogo'){S.jogoSel=b.dataset.v;render();return}
  if(act==='msg'){S.msgTipo=b.dataset.v;render();return}
  if(act==='qr'){S.qrPlano=b.dataset.v;render();return}
  if(act==='copiarCC'||act==='copiarChave'){
    const txt=act==='copiarCC'?document.getElementById('ccTxt').textContent:S.cfg.pix;
    try{await navigator.clipboard.writeText(txt);toast(act==='copiarCC'?'Código Pix copiado':'Chave Pix copiada')}
    catch(e){if(act==='copiarCC'){const r=document.createRange();r.selectNodeContents(document.getElementById('ccTxt'));const s=getSelection();s.removeAllRanges();s.addRange(r)}toast('Não deu para copiar direto. Selecione e copie.')}
    return}
  if(act==='abrir'){S.aberto=S.aberto===id?null:id;render();return}
  if(act==='copiar'){
    const txt=document.getElementById('msgTxt').textContent;
    try{await navigator.clipboard.writeText(txt);toast('Mensagem copiada. Cole no grupo.')}
    catch(e){const r=document.createRange();r.selectNodeContents(document.getElementById('msgTxt'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Texto selecionado. Copie e cole no grupo.')}
    return}
  if(!db) return;
  b.disabled=true;
  if(act==='pagar'||act==='pagarAtr'){
    const m=act==='pagar'?S.mes:b.dataset.m;
    await grava(()=>db.doc(`pagamentos/${m}_${id}`).set({mes:m,membro:id,status:'pago',valor:valorPlano(mb),data:hojeISO}),`${mb.nome}: ${MESES[+m.slice(5)-1].toLowerCase()} pago`);
  }
  if(act==='isentar') await grava(()=>db.doc(`pagamentos/${S.mes}_${id}`).set({mes:S.mes,membro:id,status:'isento',valor:0,data:hojeISO}),`${mb.nome} isento este mês`);
  if(act==='desfazer') await grava(()=>db.doc(`pagamentos/${S.mes}_${id}`).delete(),'Desfeito');
  if(act==='plano') await grava(()=>db.doc(`integrantes/${id}`).update({plano:mb.plano==='1x'?'2x':'1x'}),'Plano alterado');
  if(act==='sair'){S.aberto=null;await grava(()=>db.doc(`integrantes/${id}`).update({ate:pagDe(mb,S.mes)?S.mes:mesAdd(S.mes,-1)}),`${mb.nome} saiu do grupo`)}
  if(act==='voltar') await grava(()=>db.doc(`integrantes/${id}`).update({ate:null,desde:(mb.desde&&mb.desde<=S.mes&&(!mb.ate||mb.ate>=mesAdd(S.mes,-1)))?mb.desde:S.mes}),`${mb.nome} voltou`);
  if(act==='cancelar'||act==='descancelar'){
    const iso=jogoAtual(); const docJ={...(S.jogos[iso]||{}),data:iso,presentes:presentes(iso)};
    if(act==='cancelar'){docJ.cancelado=true;docJ.motivo=b.dataset.v}else{delete docJ.cancelado;delete docJ.motivo}
    S.jogos[iso]=docJ; S.msgTipo='presenca'; render();
    await grava(()=>db.doc(`jogos/${iso}`).set(docJ),act==='cancelar'?'Jogo cancelado. A mensagem para o grupo está pronta.':'Cancelamento desfeito');
    return}
  if(act==='pres'){
    const iso=jogoAtual(), atual=presentes(iso), novo=atual.includes(id)?atual.filter(x=>x!==id):[...atual,id];
    const docJ={...(S.jogos[iso]||{}),data:iso,presentes:novo}; S.jogos[iso]=docJ; render();
    await grava(()=>db.doc(`jogos/${iso}`).set(docJ));
    return}
  if(act==='delUni'){await grava(()=>db.doc(`uniforme/${id}`).delete(),'Pedido removido');return}
  if(act==='avPagar') await grava(()=>db.doc(`avulsos/${id}`).update({pago:true,pagoEm:hojeISO}),'Avulso recebido');
  if(act==='delAv') await grava(()=>db.doc(`avulsos/${id}`).delete(),'Avulso apagado');
  if(act==='delDesp') await grava(()=>db.doc(`despesas/${id}`).delete(),'Despesa apagada');
  b.disabled=false;
});

async function salvaUni(id,patch){
  const db=S.db; if(!db) return;
  const mb=S.membros.find(m=>m.id===id);
  const cur=S.uni[id]||(mb?{}:{});
  const doc={...cur,...patch,em:hojeISO};
  if(patch.status&&!(Number(doc.qtd)>0)) doc.qtd=1;
  if(patch.status==='pago') doc.pagoEm=hojeISO;
  if('qtd' in patch && Number(patch.qtd)===0 && doc.status) doc.status='';
  if(mb) doc.nome=mb.nome;
  S.uni[id]=doc;
  await grava(()=>db.doc(`uniforme/${id}`).set(doc));
}
document.addEventListener('change',ev=>{
  if(ev.target.id==='euSel'){S.eu=ev.target.value||null;try{localStorage.setItem('mensal_eu',S.eu||'')}catch(e){};ev.target.blur();render();return}
  const el=ev.target.closest('[data-uf]'); if(!el) return;
  const f=el.dataset.uf; let v=el.value;
  if(f==='qtd') v=Math.max(0,Math.min(10,parseInt(v||'0',10)||0));
  if(f==='nomeCamisa') v=v.trim().toUpperCase();
  salvaUni(el.dataset.id,{[f]:v});
  if(f==='status'||f==='qtd'){el.blur();render()}
});
document.addEventListener('focusout',()=>{setTimeout(()=>{if(S.pend)render()},0)});
window.addEventListener('hashchange',()=>{const v=VIEWS[location.hash]||'mensal';if(v!==S.view){S.view=v;render()}});

document.addEventListener('submit',async ev=>{
  ev.preventDefault(); const db=S.db; if(!db) return;
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
  const f=ev.target;
  if(f.id==='fExt'){
    const nome=f.querySelector('#eNome').value.trim(); if(!nome) return;
    let id='ext-'+slug(nome); if(S.uni[id]) id+='-'+Math.random().toString(36).slice(2,5);
    await grava(()=>db.doc(`uniforme/${id}`).set({nome,externo:true,nomeCamisa:'',tamanho:'',qtd:1,status:'',em:hojeISO}),`${nome} adicionado`);
  }
  if(f.id==='fUniCfg'){
    const uniValor=Number(f.querySelector('#uV').value)||90, uniMeta=Number(f.querySelector('#uM').value)||10, uniPrazo=f.querySelector('#uP').value||'';
    await grava(()=>db.doc('config/geral').set({...S.cfg,uniValor,uniMeta,uniPrazo}),'Valor e meta salvos');
  }
  if(f.id==='fAv'){
    const data=f.querySelector('#aData').value, nome=f.querySelector('#aNome').value.trim(), quem=f.querySelector('#aQuem').value, pago=f.querySelector('#aPago').value==='1';
    if(!data||!nome||!quem) return;
    if(data.slice(0,7)!==S.mes){toast(`Escolha um dia de ${mesLongo(S.mes).toLowerCase()}.`);return}
    await grava(()=>db.collection('avulsos').add({mes:S.mes,data,nome,quem,valor:Number(S.cfg.valorAvulso)||20,pago,pagoEm:pago?hojeISO:null}),`Avulso ${nome} lançado`);
  }
  if(f.id==='fDesp'){
    const descricao=f.querySelector('#dDesc').value.trim(), valor=Number(f.querySelector('#dVal').value);
    if(!descricao||!(valor>0)) return;
    await grava(()=>db.collection('despesas').add({mes:S.mes,descricao,valor,data:hojeISO}),'Despesa lançada');
  }
  if(f.id==='fCfg'){
    const cfg={valor2x:Number(f.querySelector('#cV2').value)||0,valor1x:Number(f.querySelector('#cV1').value)||0,
      cobranca:Number(f.querySelector('#cCob').value)||1,valorAvulso:Number(f.querySelector('#cAv').value)||20,minSab:Number(f.querySelector('#cMinS').value)||10,minTer:Number(f.querySelector('#cMinT').value)||8,vencimento:Number(f.querySelector('#cVenc').value)||10,saldoInicial:Number(f.querySelector('#cSaldo').value)||0,pix:f.querySelector('#cPix').value.trim(),pixNome:f.querySelector('#cPixNome').value.trim(),pixCidade:f.querySelector('#cPixCid').value.trim()};
    await grava(()=>db.doc('config/geral').set({...S.cfg,...cfg}),'Ajustes salvos');
  }
  if(f.id==='fNovo'){
    const nome=f.querySelector('#nNome').value.trim(), plano=f.querySelector('#nPlano').value; if(!nome) return;
    let id=slug(nome); if(S.membros.some(x=>x.id===id)) id+='-'+Math.random().toString(36).slice(2,6);
    await grava(()=>db.doc(`integrantes/${id}`).set({nome,plano,desde:S.mes,ate:null}),`${nome} entrou no mensal`);
  }
});

// ---------- Firebase: dados, login e permissão ----------
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
let fs;
try{fs=initializeFirestore(app,{ignoreUndefinedProperties:true,localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}
catch(e){fs=initializeFirestore(app,{ignoreUndefinedProperties:true})}
const BASE=`grupos/${GRUPO}/`;
const qSnap=qs=>({docs:qs.docs.map(d=>({id:d.id,data:()=>d.data()}))});
const DB={
  collection(p){const ref=collection(fs,BASE+p);return {onSnapshot:(cb,err)=>onSnapshot(ref,qs=>cb(qSnap(qs)),err),add:d=>addDoc(ref,d)}},
  doc(p){const ref=doc(fs,BASE+p);return {set:d=>setDoc(ref,d),update:d=>updateDoc(ref,d),delete:()=>deleteDoc(ref),
    onSnapshot:(cb,err)=>onSnapshot(ref,x=>cb({exists:x.exists(),data:()=>x.data()}),err)}}
};
S.db=DB; S.usuario=null;

function rodape(){
  const el=document.getElementById('rodape'); if(!el) return;
  if(S.usuario){
    el.innerHTML=`${S.pode?'Organizador':'Conectado'}: ${esc(S.usuario.email)} · <button class="lnk" data-act="sair">Sair</button>${S.pode?' · <button class="lnk" data-act="backup">Baixar backup</button>':''}`;
    if(!S.pode) el.innerHTML+=`<br>Esta conta não tem permissão para alterar o mensal.`;
  } else el.innerHTML=`Só o organizador altera os dados. <button class="lnk" data-act="entrar">Entrar como organizador</button>`;
}

async function verificaPermissao(u){
  if(!u||!u.email){S.pode=false;return}
  try{
    const adm=await getDoc(doc(fs,'admins',u.email.toLowerCase()));
    if(adm.exists()){S.pode=true;return}
  }catch(e){}
  try{
    const org=await getDoc(doc(fs,BASE+'organizadores',u.email.toLowerCase()));
    S.pode=org.exists();
  }catch(e){S.pode=false}
}
onAuthStateChanged(auth,async u=>{
  S.usuario=u&&!u.isAnonymous?u:null;
  await verificaPermissao(S.usuario);
  render();rodape();
});

async function entrar(){
  const p=new GoogleAuthProvider();
  try{await signInWithPopup(auth,p)}
  catch(e){if(String(e.code).includes('popup-blocked'))await signInWithRedirect(auth,p);else toast('Não foi possível entrar. Tente de novo.')}
}

// Backup: baixar tudo em JSON e importar de volta
function dadosAtuais(){const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
  return {versao:1,grupo:GRUPO,em:new Date().toISOString(),membros:[...S.membros].sort(byId),pag:S.pag,desp:[...S.desp].sort(byId),avul:[...S.avul].sort(byId),jogos:S.jogos,uni:S.uni,cfg:S.cfg}}
function baixarBackup(){
  const blob=new Blob([JSON.stringify(dadosAtuais(),null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mensal-100compromisso-${hojeISO}.json`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
async function importarBackup(B){
  const ops=[];
  const sem=o=>{const c={...o};delete c.id;return c};
  (B.membros||[]).forEach(m=>ops.push([`integrantes/${m.id}`,sem(m)]));
  Object.entries(B.pag||{}).forEach(([id,v])=>ops.push([`pagamentos/${id}`,v]));
  (B.desp||[]).forEach(d=>ops.push([`despesas/${d.id}`,sem(d)]));
  (B.avul||[]).forEach(a=>ops.push([`avulsos/${a.id}`,sem(a)]));
  Object.entries(B.jogos||{}).forEach(([id,v])=>ops.push([`jogos/${id}`,v]));
  Object.entries(B.uni||{}).forEach(([id,v])=>ops.push([`uniforme/${id}`,v]));
  if(B.cfg) ops.push(['config/geral',B.cfg]);
  for(let i=0;i<ops.length;i+=400){
    const lote=writeBatch(fs);
    ops.slice(i,i+400).forEach(([p,d])=>lote.set(doc(fs,BASE+p),d));
    await lote.commit();
  }
  return ops.length;
}
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-act]'); if(!b) return;
  const act=b.dataset.act;
  if(act==='entrar') entrar();
  if(act==='sair') {await signOut(auth);toast('Você saiu.')}
  if(act==='backup') baixarBackup();
  if(act==='importarInicial'){
    b.disabled=true;
    try{const r=await fetch('dados/backup-inicial.json',{cache:'no-store'});const n=await importarBackup(await r.json());toast(`Dados importados (${n} registros).`)}
    catch(e){toast('Não consegui importar. Confira se você entrou como organizador.')}
    b.disabled=false;
  }
});
document.addEventListener('change',async ev=>{
  if(ev.target.id!=='impArq'||!ev.target.files[0]) return;
  try{const B=JSON.parse(await ev.target.files[0].text());const n=await importarBackup(B);toast(`Backup importado (${n} registros).`)}
  catch(e){toast('Arquivo de backup inválido ou sem permissão.')}
  ev.target.value='';
});

const pronto=()=>{render()};
const falhou=()=>{S.semDb=true;render()};
DB.collection('integrantes').onSnapshot(s=>{S.membros=s.docs.map(d=>({id:d.id,...d.data()}));S.ok.m=true;pronto()},falhou);
DB.collection('pagamentos').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());S.pag=o;S.ok.p=true;pronto()},falhou);
DB.collection('despesas').onSnapshot(s=>{S.desp=s.docs.map(d=>({id:d.id,...d.data()}));S.ok.d=true;pronto()},falhou);
DB.collection('uniforme').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());S.uni=o;S.ok.u=true;pronto()},falhou);
DB.collection('jogos').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());S.jogos=o;S.ok.j=true;pronto()},falhou);
DB.collection('avulsos').onSnapshot(s=>{S.avul=s.docs.map(d=>({id:d.id,...d.data()}));S.ok.a=true;pronto()},falhou);
DB.doc('config/geral').onSnapshot(s=>{if(s.exists)S.cfg={...S.cfg,...s.data()};S.ok.c=true;pronto()},falhou);
render();rodape();

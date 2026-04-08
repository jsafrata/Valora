import { useState, useCallback } from "react";

const NUM_RESELLERS = 4;
const NUM_ROUNDS = 6;
const INITIAL_CASH = 200;
const MAX_INVENTORY = 12;
const HOLDING_COST = 3;
const SCHEDULE_LENGTH = 10;
const PLAYER_ID = 0;

const REGION_NAMES = ["North", "East", "South", "West"];
const REGION_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"];
const RESELLER_NAMES = ["You", "Bot-A", "Bot-B", "Bot-C"];

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function genProdSched() {
  let ps = [], p = randInt(5, 12);
  for (let i = 0; i < SCHEDULE_LENGTH; i++) { ps.push(p); p += randInt(1, 5); }
  return ps;
}
function genConsSched() {
  let ps = [], p = randInt(30, 50);
  for (let i = 0; i < SCHEDULE_LENGTH; i++) { ps.push(Math.max(1, p)); p -= randInt(2, 7); }
  return ps;
}
function genMarket() {
  let m = {};
  for (let z = 0; z < 4; z++) m[z] = { prod: genProdSched(), cons: genConsSched(), pi: 0, ci: 0 };
  return m;
}
function genWindows() {
  let w = [[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
  for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [w[i],w[j]]=[w[j],w[i]]; }
  return w;
}
function initR() {
  return Array.from({length:NUM_RESELLERS},(_,i)=>({id:i,name:RESELLER_NAMES[i],region:i,cash:INITIAL_CASH,inv:0}));
}

function aiSellPrice(ai, m) {
  const r = m[ai.region];
  if (ai.inv <= 0) return null;
  const nc = r.ci < r.cons.length ? r.cons[r.ci] : 0;
  return Math.max(Math.floor(nc * 0.9), 8);
}
function aiBuyPrice(ai, m) {
  const r = m[ai.region];
  if (ai.inv >= MAX_INVENTORY - 1 || ai.cash < 8) return null;
  const nc = r.ci < r.cons.length ? r.cons[r.ci] : 0;
  return Math.max(Math.floor(nc * 0.65), 8);
}
function aiBuy(rs, m) {
  const r = m[rs.region]; let b=0, cash=rs.cash, inv=rs.inv;
  for (let i=0; i<Math.min(3,MAX_INVENTORY-inv); i++) {
    const idx=r.pi+b; if(idx>=r.prod.length)break;
    const c=r.prod[idx], fv=r.cons[Math.min(r.ci+i,r.cons.length-1)]||0;
    if(c<fv*0.85&&cash>=c){cash-=c;inv++;b++;}else break;
  }
  return b;
}
function aiSell(rs, m) {
  const r = m[rs.region]; let s=0, inv=rs.inv;
  while(inv>0){const idx=r.ci+s;if(idx>=r.cons.length)break;if(r.cons[idx]>=8){s++;inv--;}else break;}
  return s;
}

const PHASES=["BUY","SELL1","TRADE","SELL2","END"];
const PHASE_LABELS={BUY:"Phase 1 · Buy from Producers",SELL1:"Phase 2 · Sell to Consumers",TRADE:"Phase 3 · Reseller Trading",SELL2:"Phase 4 · Sell to Consumers",END:"End of Round"};

export default function Game() {
  const [gs, setGs] = useState("MENU");
  const [round, setRound] = useState(1);
  const [pi, setPi] = useState(0);
  const [rs, setRs] = useState(initR());
  const [mk, setMk] = useState(null);
  const [log, setLog] = useState([]);
  const [wins, setWins] = useState([]);
  const [wi, setWi] = useState(0);
  const [tp, setTp] = useState(null);

  const phase = PHASES[pi];
  const me = rs[PLAYER_ID];
  const addLog = useCallback((m) => setLog(p => [...p.slice(-40), m]), []);

  const start = useCallback(() => {
    setMk(genMarket()); setRs(initR()); setRound(1); setPi(0);
    setLog(["Round 1 begins."]); const w=genWindows(); setWins(w); setWi(0); setTp(null); setGs("PLAY");
  }, []);

  const setupTW = useCallback((idx, w) => {
    if(idx>=3){setTp(null);return;}
    const pair=(w||wins)[idx]?.find(p=>p.includes(PLAYER_ID));
    setTp(pair ? (pair[0]===PLAYER_ID?pair[1]:pair[0]) : -1);
  },[wins]);

  const runAI = useCallback((ph) => {
    setMk(prev => {
      const m = JSON.parse(JSON.stringify(prev));
      setRs(rs => {
        const n = rs.map(r=>({...r}));
        for(let i=1;i<NUM_RESELLERS;i++){
          if(ph==="BUY"){
            const b=aiBuy(n[i],m);
            for(let j=0;j<b;j++){n[i].cash-=m[n[i].region].prod[m[n[i].region].pi];n[i].inv++;m[n[i].region].pi++;}
            if(b>0)addLog(`${n[i].name} bought ${b} units`);
          } else {
            const s=aiSell(n[i],m);
            for(let j=0;j<s;j++){n[i].cash+=m[n[i].region].cons[m[n[i].region].ci];n[i].inv--;m[n[i].region].ci++;}
            if(s>0)addLog(`${n[i].name} sold ${s} units`);
          }
        }
        return n;
      });
      return m;
    });
  },[addLog]);

  const aiTrades = useCallback((idx) => {
    const w=(wins)[idx]; if(!w)return;
    w.forEach(pair=>{
      if(pair.includes(PLAYER_ID))return;
      setRs(rs=>{
        const n=rs.map(r=>({...r}));const[a,b]=pair;
        if(n[a].inv>0&&n[b].cash>=15&&n[b].inv<MAX_INVENTORY){
          n[a].cash+=15;n[a].inv--;n[b].cash-=15;n[b].inv++;
          addLog(`${n[a].name} sold to ${n[b].name} for $15`);
        }
        return n;
      });
    });
  },[wins,addLog]);

  const advance = useCallback(() => {
    if(phase==="BUY")runAI("BUY");
    if(phase==="SELL1"||phase==="SELL2")runAI("SELL");
    if(phase==="END"){
      setRs(rs=>rs.map(r=>({...r,cash:r.cash-HOLDING_COST*r.inv})));
      if(round>=NUM_ROUNDS){setGs("OVER");addLog("Game over!");return;}
      const m=genMarket();setMk(m);setRound(r=>r+1);setPi(0);
      const w=genWindows();setWins(w);setWi(0);setTp(null);
      addLog(`Round ${round+1} begins.`);return;
    }
    const nx=pi+1;setPi(nx);
    if(PHASES[nx]==="TRADE"){setWi(0);setupTW(0);}
    addLog(`→ ${PHASE_LABELS[PHASES[nx]]}`);
  },[phase,pi,round,runAI,addLog,setupTW]);

  const pBuy = useCallback(() => {
    if(phase!=="BUY")return;
    setMk(prev=>{
      const m=JSON.parse(JSON.stringify(prev));const r=m[me.region];
      if(r.pi>=r.prod.length)return prev;
      const cost=r.prod[r.pi];
      if(me.cash<cost||me.inv>=MAX_INVENTORY)return prev;
      setRs(rs=>{const n=[...rs];n[0]={...n[0],cash:n[0].cash-cost,inv:n[0].inv+1};return n;});
      r.pi++;addLog(`You bought 1 unit for $${cost}`);return m;
    });
  },[phase,me,addLog]);

  const pSell = useCallback(() => {
    if(phase!=="SELL1"&&phase!=="SELL2")return;
    setMk(prev=>{
      const m=JSON.parse(JSON.stringify(prev));const r=m[me.region];
      if(r.ci>=r.cons.length||me.inv<=0)return prev;
      const price=r.cons[r.ci];
      setRs(rs=>{const n=[...rs];n[0]={...n[0],cash:n[0].cash+price,inv:n[0].inv-1};return n;});
      r.ci++;addLog(`You sold 1 unit for $${price}`);return m;
    });
  },[phase,me,addLog]);

  const doTrade = useCallback((action) => {
    if(tp===null||tp===-1)return;
    if(action==="skip"){
      aiTrades(wi);const nw=wi+1;
      if(nw>=3){setWi(3);setTp(null);}else{setWi(nw);setupTW(nw);}
      return;
    }
    setRs(rs=>{
      const n=rs.map(r=>({...r}));const p=n[tp],m2=n[0];
      if(action==="buy"){
        const price=aiSellPrice(p,mk);
        if(price&&m2.cash>=price&&m2.inv<MAX_INVENTORY&&p.inv>0){
          m2.cash-=price;m2.inv++;p.cash+=price;p.inv--;
          addLog(`You bought from ${p.name} for $${price}`);
        }
      }else{
        const price=aiBuyPrice(p,mk);
        if(price&&p.cash>=price&&m2.inv>0&&p.inv<MAX_INVENTORY){
          m2.cash+=price;m2.inv--;p.cash-=price;p.inv++;
          addLog(`You sold to ${p.name} for $${price}`);
        }
      }
      return n;
    });
  },[tp,wi,mk,aiTrades,setupTW,addLog]);

  const np = mk?.[me.region]; 
  const nextBuy = np && np.pi<np.prod.length ? np.prod[np.pi] : null;
  const nextSell = np && np.ci<np.cons.length ? np.cons[np.ci] : null;
  let askP=null, bidP=null;
  if(tp!==null&&tp>=0&&mk){askP=aiSellPrice(rs[tp],mk);bidP=aiBuyPrice(rs[tp],mk);}
  const canBuy = nextBuy!==null&&me.cash>=nextBuy&&me.inv<MAX_INVENTORY;
  const canSell = nextSell!==null&&me.inv>0;

  const f = "'DM Mono',monospace";
  const B = (bg,c,bd,dis) => ({padding:"9px 18px",fontSize:11,fontWeight:700,fontFamily:f,background:bg,color:c,border:`1px solid ${bd}`,cursor:dis?"default":"pointer",opacity:dis?0.3:1,borderRadius:2});

  if(gs==="MENU") return (
    <div style={{minHeight:"100vh",background:"#09090b",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:f,color:"#e0e0e0"}}>
      <div style={{fontSize:32,fontWeight:700,letterSpacing:8,color:"#fff",marginBottom:4}}>VALORA</div>
      <div style={{fontSize:12,color:"#555",letterSpacing:8,marginBottom:48,textTransform:"uppercase"}}>Trading Game</div>
      <div style={{fontSize:11,color:"#444",maxWidth:400,textAlign:"center",lineHeight:1.8,marginBottom:36}}>
        Buy from producers · Sell to consumers · Trade with rivals<br/>{NUM_ROUNDS} rounds · ${INITIAL_CASH} starting cash · {MAX_INVENTORY} max inventory
      </div>
      <button onClick={start} style={{padding:"14px 48px",fontSize:13,fontWeight:700,fontFamily:f,letterSpacing:4,textTransform:"uppercase",background:"transparent",color:"#3b82f6",border:"2px solid #3b82f6",cursor:"pointer"}}>Start</button>
    </div>
  );

  if(gs==="OVER"){
    const sorted=[...rs].sort((a,b)=>b.cash-a.cash);const won=sorted[0].id===PLAYER_ID;
    return (
      <div style={{minHeight:"100vh",background:"#09090b",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:f,color:"#e0e0e0"}}>
        <div style={{fontSize:26,fontWeight:700,color:won?"#10b981":"#ef4444",marginBottom:24,letterSpacing:4}}>{won?"YOU WIN":"GAME OVER"}</div>
        {sorted.map((r,i)=><div key={r.id} style={{fontSize:13,padding:"5px 0",color:r.id===PLAYER_ID?"#fff":"#777",fontWeight:r.id===PLAYER_ID?700:400}}>#{i+1} {r.name} — ${r.cash}</div>)}
        <button onClick={start} style={{marginTop:28,padding:"12px 36px",fontSize:12,fontWeight:700,fontFamily:f,letterSpacing:3,background:"transparent",color:"#3b82f6",border:"2px solid #3b82f6",cursor:"pointer"}}>Play Again</button>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#09090b",fontFamily:f,color:"#e0e0e0",padding:20}}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } } @keyframes breathe { 0%,100% { box-shadow: 0 0 30px #3b82f630, 0 0 60px #3b82f615; } 50% { box-shadow: 0 0 40px #3b82f650, 0 0 80px #3b82f625; } }`}</style>
      {/* HEADER */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:12,borderBottom:"1px solid #1a1a1a"}}>
        <div><span style={{fontSize:15,fontWeight:700,letterSpacing:3,color:"#fff"}}>ROUND {round}</span><span style={{fontSize:11,color:"#444",marginLeft:6}}>/ {NUM_ROUNDS}</span></div>
        <div style={{fontSize:11,color:"#888",fontWeight:600,letterSpacing:1}}>{PHASE_LABELS[phase]}</div>
        <div style={{fontSize:13}}><span style={{color:"#10b981",fontWeight:700}}>${me.cash}</span><span style={{color:"#333",margin:"0 8px"}}>|</span><span style={{color:"#f59e0b",fontWeight:700}}>{me.inv}u</span></div>
      </div>

      <div style={{display:"flex",gap:20}}>
        {/* REGIONS 2x2 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,width:380,flexShrink:0,alignSelf:"start"}}>
          {[0,1,2,3].map(z=>{
            const isP=z===me.region;
            const isTradePartner=phase==="TRADE"&&tp!==null&&tp>=0&&rs[tp].region===z;
            const rr=rs.filter(r=>r.region===z);
            const pp=mk&&mk[z].pi<mk[z].prod.length?mk[z].prod[mk[z].pi]:null;
            const cp=mk&&mk[z].ci<mk[z].cons.length?mk[z].cons[mk[z].ci]:null;
            const rc=REGION_COLORS[z];
            return (
              <div key={z} style={{width:183,height:183,borderRadius:"50%",
                border:isP?`5px solid ${rc}`:isTradePartner?`3px solid ${rc}`:`2px solid ${rc}60`,
                outline:isP?`3px solid ${rc}40`:"none",outlineOffset:4,
                background:isP?`radial-gradient(circle at center, ${rc}25 0%, ${rc}08 70%, #0d0d0d 100%)`:isTradePartner?`${rc}15`:"#0d0d0d",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                boxShadow:isP?`0 0 30px ${rc}30, 0 0 60px ${rc}15`:isTradePartner?`0 0 24px ${rc}25`:"none",
                animation:isP?"breathe 3s ease-in-out infinite":"none",
                transition:"all 0.3s ease",position:"relative"}}>
                {isP&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#fff",fontWeight:700,letterSpacing:2,textTransform:"uppercase",background:rc,padding:"2px 10px",borderRadius:10,boxShadow:`0 2px 8px ${rc}50`}}>★ YOU</div>}
                {isTradePartner&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",fontSize:8,color:rc,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",background:"#09090b",padding:"2px 8px",borderRadius:10,border:`1px solid ${rc}`,animation:"pulse 1.5s ease-in-out infinite"}}>TRADING</div>}
                <div style={{fontSize:10,fontWeight:700,color:rc,textTransform:"uppercase",letterSpacing:2.5,marginBottom:8,marginTop:6}}>{REGION_NAMES[z]}</div>
                {rr.map(r=>{
                  const isMe=r.id===PLAYER_ID;
                  const isTp=phase==="TRADE"&&tp!==null&&tp>=0&&r.id===tp;
                  if(isMe) return <div key={r.id} style={{fontSize:11,color:"#fff",fontWeight:700,lineHeight:1.6,background:`${REGION_COLORS[r.region]}30`,padding:"2px 10px",borderRadius:4,border:`1px solid ${REGION_COLORS[r.region]}50`}}>► You: ${r.cash} · {r.inv}u</div>;
                  if(isTp) return <div key={r.id} style={{fontSize:10,color:REGION_COLORS[r.region],fontWeight:700,lineHeight:1.6,background:`${REGION_COLORS[r.region]}15`,padding:"1px 8px",borderRadius:3}}>{r.name}: ${r.cash} · {r.inv}u</div>;
                  return <div key={r.id} style={{fontSize:10,color:"#555",fontWeight:400,lineHeight:1.6,padding:"1px 0"}}>{r.name}: ${r.cash} · {r.inv}u</div>;
                })}
                <div style={{marginTop:8,fontSize:9,color:"#555",textAlign:"center",lineHeight:1.5}}>
                  {pp!==null&&<div>buy: <span style={{color:"#6b9bff"}}>${pp}</span></div>}
                  {cp!==null&&<div>sell: <span style={{color:"#34d399"}}>${cp}</span></div>}
                  {pp===null&&cp===null&&<div style={{color:"#333"}}>exhausted</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT */}
        <div style={{flex:1,minWidth:0}}>
          {/* STATUS */}
          <div style={{background:"#111",border:"1px solid #1e1e1e",padding:14,marginBottom:14}}>
            <div style={{fontSize:10,color:"#444",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Your Region · {REGION_NAMES[me.region]}</div>
            <div style={{display:"flex",gap:24}}>
              <div><div style={{fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:1}}>Next Buy Price</div><div style={{fontSize:22,fontWeight:700,color:nextBuy!==null?"#3b82f6":"#333"}}>{nextBuy!==null?`$${nextBuy}`:"—"}</div></div>
              <div><div style={{fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:1}}>Next Sell Price</div><div style={{fontSize:22,fontWeight:700,color:nextSell!==null?"#10b981":"#333"}}>{nextSell!==null?`$${nextSell}`:"—"}</div></div>
              <div><div style={{fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:1}}>Inventory</div><div style={{fontSize:22,fontWeight:700,color:"#f59e0b"}}>{me.inv}<span style={{fontSize:11,color:"#555"}}>/{MAX_INVENTORY}</span></div></div>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{background:"#0f0f0f",border:"1px solid #1e1e1e",padding:16,marginBottom:14,minHeight:110}}>
            {phase==="BUY"&&<div>
              <div style={{fontSize:11,color:"#999",marginBottom:12}}>Buy units one at a time. Each purchase reveals the next price.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={pBuy} disabled={!canBuy} style={B("#3b82f615","#3b82f6","#3b82f640",!canBuy)}>Buy 1 · ${nextBuy??"—"}</button>
                <button onClick={advance} style={B("transparent","#555","#2a2a2a",false)}>Done →</button>
              </div>
            </div>}

            {(phase==="SELL1"||phase==="SELL2")&&<div>
              <div style={{fontSize:11,color:"#999",marginBottom:12}}>Sell units one at a time. Each sale reveals the next price.{phase==="SELL2"&&<span style={{color:"#666"}}> (continues from earlier)</span>}</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={pSell} disabled={!canSell} style={B("#10b98115","#10b981","#10b98140",!canSell)}>Sell 1 · ${nextSell??"—"}</button>
                <button onClick={advance} style={B("transparent","#555","#2a2a2a",false)}>Done →</button>
              </div>
            </div>}

            {phase==="TRADE"&&<div>
              {tp!==null&&tp>=0&&wi<3?<div>
                <div style={{fontSize:11,color:"#999",marginBottom:6}}>
                  Window {wi+1}/3 — with <span style={{color:REGION_COLORS[rs[tp].region],fontWeight:700}}>{rs[tp].name}</span>
                  <span style={{color:"#555"}}> ({REGION_NAMES[rs[tp].region]} · ${rs[tp].cash} · {rs[tp].inv}u)</span>
                </div>
                <div style={{display:"flex",gap:16,margin:"12px 0",padding:"10px 14px",background:"#141414",border:"1px solid #222"}}>
                  <div><div style={{fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Their ask (you buy)</div><div style={{fontSize:18,fontWeight:700,color:askP?"#3b82f6":"#333"}}>{askP?`$${askP}`:"won't sell"}</div></div>
                  <div style={{width:1,background:"#222"}}/>
                  <div><div style={{fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Their bid (you sell)</div><div style={{fontSize:18,fontWeight:700,color:bidP?"#f59e0b":"#333"}}>{bidP?`$${bidP}`:"won't buy"}</div></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>doTrade("buy")} disabled={!askP||me.cash<askP||me.inv>=MAX_INVENTORY||rs[tp].inv<=0} style={B("#3b82f615","#3b82f6","#3b82f640",!askP||me.cash<askP||me.inv>=MAX_INVENTORY||rs[tp].inv<=0)}>Buy · ${askP??"—"}</button>
                  <button onClick={()=>doTrade("sell")} disabled={!bidP||me.inv<=0||rs[tp].cash<bidP||rs[tp].inv>=MAX_INVENTORY} style={B("#f59e0b15","#f59e0b","#f59e0b40",!bidP||me.inv<=0||rs[tp].cash<bidP||rs[tp].inv>=MAX_INVENTORY)}>Sell · ${bidP??"—"}</button>
                  <button onClick={()=>doTrade("skip")} style={B("transparent","#555","#2a2a2a",false)}>Skip →</button>
                </div>
              </div>
              :tp===-1&&wi<3?<div>
                <div style={{fontSize:11,color:"#666",marginBottom:10}}>Window {wi+1}/3 — AI bots trading.</div>
                <button onClick={()=>{aiTrades(wi);const nw=wi+1;if(nw>=3){setWi(3);setTp(null);}else{setWi(nw);setupTW(nw);}}} style={B("transparent","#555","#2a2a2a",false)}>Continue →</button>
              </div>
              :<div>
                <div style={{fontSize:11,color:"#666",marginBottom:10}}>All 3 trading windows complete.</div>
                <button onClick={()=>{const nx=pi+1;setPi(nx);addLog(`→ ${PHASE_LABELS[PHASES[nx]]}`);}} style={B("transparent","#555","#2a2a2a",false)}>Proceed →</button>
              </div>}
            </div>}

            {phase==="END"&&<div>
              <div style={{fontSize:11,color:"#999",marginBottom:12}}>Holding cost: <span style={{color:"#ef4444"}}>${HOLDING_COST} × {me.inv} = ${HOLDING_COST*me.inv}</span></div>
              <button onClick={advance} style={B(round>=NUM_ROUNDS?"#ef444415":"transparent",round>=NUM_ROUNDS?"#ef4444":"#555",round>=NUM_ROUNDS?"#ef444440":"#2a2a2a",false)}>{round>=NUM_ROUNDS?"End Game":"Next Round →"}</button>
            </div>}
          </div>

          {/* STANDINGS */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,color:"#333",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>Standings</div>
            {rs.slice().sort((a,b)=>b.cash-a.cash).map(r=>(
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 8px",color:r.id===PLAYER_ID?"#fff":"#555",fontWeight:r.id===PLAYER_ID?700:400,background:r.id===PLAYER_ID?"#ffffff08":"transparent",borderLeft:`2px solid ${r.id===PLAYER_ID?REGION_COLORS[r.region]:"#1a1a1a"}`}}>
                <span>{r.name} · {REGION_NAMES[r.region]}</span><span>${r.cash} · {r.inv}u</span>
              </div>
            ))}
          </div>

          {/* LOG */}
          <div style={{background:"#0a0a0a",border:"1px solid #151515",padding:10,maxHeight:130,overflowY:"auto"}}>
            <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>Log</div>
            {log.slice().reverse().map((m,i)=><div key={i} style={{fontSize:10,color:i===0?"#777":"#3a3a3a",lineHeight:1.6}}>{m}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

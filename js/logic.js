/* =========================================================
   SmartWardrobe — шар 3: логіка
   Чисті функції: рахують і перетворюють дані.
   ПРАВИЛО: тут немає жодного document і жодної зміни стану.
   ========================================================= */

/* ---------- Дрібні помічники ---------- */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hexOk=h=>/^#[0-9a-f]{6}$/i.test(h||"")?h:"#c9c3d3";
const newId=()=>"i"+Math.random().toString(36).slice(2,10);
const today=()=>new Date().toISOString().slice(0,10);
const daysBetween=(a,b)=>Math.round((b-a)/86400000);
const tempLabel=v=>(v>0?"+":"")+v+"°";

/* ---------- Аналітика гардеробу ---------- */
const itemById=id=>state.items.find(i=>i.id===id);
function daysUnworn(it){
  if(it.lastWorn)return daysBetween(it.lastWorn,Date.now());
  return it.createdAt?daysBetween(it.createdAt,Date.now()):0;
}
const isForgotten=it=>(it.wearCount>0)?daysUnworn(it)>=FORGOT_DAYS:daysUnworn(it)>=NEW_GRACE_DAYS;
function forgottenItems(){
  return state.items.filter(isForgotten).sort((a,b)=>daysUnworn(b)-daysUnworn(a));
}
function costPerWear(it){
  if(!it.price||!(it.wearCount>0))return null;
  return Math.round(it.price/it.wearCount);
}
function catalogText(items){
  return items.map(i=>[i.id,i.name,CATS[i.category]?.label,i.color,STYLES[i.style],(i.seasons||[]).map(s=>SEASONS[s]).join("/"),
    "тепло "+(i.warmth||2)+"/5","вдягали "+(i.wearCount||0)+" р."].join(" | ")).join("\n");
}
/** Скільки нових комбінацій додасть річ цієї категорії. */
function newCombos(cat){
  const n=c=>state.items.filter(i=>i.category===c).length;
  const shoes=Math.max(1,n("shoes"));
  if(cat==="top")return n("bottom")*shoes;
  if(cat==="bottom")return n("top")*shoes;
  if(cat==="dress")return shoes;
  if(cat==="outer"||cat==="acc"||cat==="shoes")return n("top")*n("bottom")+n("dress");
  return 0;
}


/* ---------- Рівні та прогрес челенджів ---------- */
function levelOf(points){
  let cur=LEVELS[0],next=null;
  for(let i=0;i<LEVELS.length;i++){if(points>=LEVELS[i].p)cur=LEVELS[i];else{next=LEVELS[i];break}}
  return {cur,next};
}
const sig=ids=>[...ids].sort().join(",");
function challengeProgress(ch){
  const st=state.challenges[ch.id]||{};
  const since=st.startedAt||0;
  const log=state.wearLog.filter(w=>(w.at||0)>=since);
  if(ch.id==="digitize")return state.items.length;
  if(ch.id==="no-repeat"){
    const seen=new Set(),days=new Set();
    for(const w of log){const s=sig(w.items);if(seen.has(s))continue;seen.add(s);days.add(w.d)}
    return days.size;
  }
  if(ch.id==="hero"){
    const per={};
    for(const w of log){const s=sig(w.items);for(const id of w.items){(per[id]=per[id]||new Set()).add(s)}}
    const best=Object.entries(per).sort((a,b)=>b[1].size-a[1].size)[0];
    return best?best[1].size:0;
  }
  if(ch.id==="revive"){
    const target=new Set(st.targets||[]);
    const worn=new Set();
    for(const w of log)for(const id of w.items)if(target.has(id))worn.add(id);
    return worn.size;
  }
  return 0;
}

/* ---------- Посилання на пошук у магазині ---------- */
/**
 * Будує посилання на пошук речі.
 * @param query    що шукаємо
 * @param site     домен конкретного магазину; без нього — пошук по всіх магазинах
 * @param maxPrice стеля ціни в гривнях
 *
 * Без site використовується пошук по товарах із фільтром ціни — він показує
 * саме ті магазини, де річ є за вказану ціну. Ціну додаємо і у фільтр, і в
 * текст запиту: якщо фільтр колись перестане діяти, пошук усе одно спрацює.
 */
function shopSearchUrl(query,site,maxPrice){
  const q=String(query||"").trim();
  const cap=Number(maxPrice)>0?Math.round(Number(maxPrice)):0;
  const withCap=q+(cap?` до ${cap} грн`:"");
  if(site)return "https://www.google.com/search?hl=uk&gl=ua&q="+encodeURIComponent(withCap+" site:"+site);
  let url="https://www.google.com/search?tbm=shop&hl=uk&gl=ua&q="+encodeURIComponent(withCap);
  if(cap)url+="&tbs="+encodeURIComponent("mr:1,price:1,ppr_max:"+cap);
  return url;
}

/* ---------- Ініціали для аватара без фото ---------- */
function initials(name){
  const parts=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return "🙂";
  return (parts[0][0]+(parts[1]?parts[1][0]:"")).toUpperCase();
}

/* ---------- Тариф: що дозволено ---------- */
const isPremium=()=>!!state.premium;
const canUse=feature=>isPremium()||!PLAN.premiumOnly[feature];
const itemLimit=()=>isPremium()?Infinity:PLAN.freeItems;
const styleLimit=()=>isPremium()?PLAN.premiumStyles:PLAN.freeStyles;
/** Відповідь на питання анкети завжди як масив — навіть якщо колись збереглася рядком. */
const asList=v=>Array.isArray(v)?v:(v?[v]:[]);

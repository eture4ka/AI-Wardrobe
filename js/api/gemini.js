/* =========================================================
   SmartWardrobe — шар 4: зовнішній сервіс — Google Gemini
   Усе спілкування з AI. Файл не знає ні про стан, ні про сторінку:
   на вхід — текст і картинки, на вихід — розібрана відповідь або помилка.
   ========================================================= */



/* Моделі, які Google вимкнув для цього ключа (відповідь 404 «no longer available»).
   Запам'ятовуємо їх у браузері, щоб більше ніколи не обирати. */
const DEAD_LS="smartwardrobe-dead-models";
const deadModels=new Set((()=>{try{return JSON.parse(localStorage.getItem(DEAD_LS)||"[]")}catch(e){return []}})());
function markDead(model){
  deadModels.add(model);
  try{localStorage.setItem(DEAD_LS,JSON.stringify([...deadModels]))}catch(e){}
  console.warn("Модель більше не доступна, прибираю зі списку:",model);
}
const alive=n=>!deadModels.has(n);

/** Моделі для ролі в порядку переваги: спершу наш список, потім решта схожих з каталогу Google. */
function candidatesFor(role){
  const prefs=MODEL_PREFS[role]||MODEL_PREFS.smart;
  const kind=role==="image"?(n=>/image/i.test(n)):(n=>!/image/i.test(n)&&/flash/i.test(n));
  const fromPrefs=prefs.filter(n=>MODELS.list.includes(n));
  const rest=MODELS.list.filter(n=>kind(n)&&!fromPrefs.includes(n))
    .sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));   // новіші версії першими
  return [...new Set([...fromPrefs,...rest])].filter(alive);
}

async function loadModels(force){
  if(MODELS.loaded&&!force)return;
  const key=getKey();if(!key)return;
  try{
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",{headers:{"x-goog-api-key":key}});
    if(!r.ok)throw new Error("list "+r.status);
    const d=await r.json();
    MODELS.list=(d.models||[])
      .filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent"))
      .map(m=>String(m.name||"").replace(/^models\//,""))
      .filter(n=>n&&!BAD_MODEL.test(n)&&alive(n));
  }catch(e){console.warn("Не вдалося отримати список моделей",e);MODELS.list=[]}
  MODELS.image=candidatesFor("image")[0]||null;
  MODELS.smart=candidatesFor("smart")[0]||null;
  MODELS.fast=candidatesFor("fast").find(n=>/lite/i.test(n))||MODELS.smart;
  MODELS.loaded=true;
  console.info("Доступні моделі:",MODELS.list,"| обрано:",{fast:MODELS.fast,smart:MODELS.smart,image:MODELS.image});
}

const getKey=()=>{try{return localStorage.getItem(KEY_LS)||""}catch(e){return ""}};
const blobToB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(b)});
const dataUrlToB64=u=>String(u||"").split(",")[1]||"";

function parseJSON(text){
  const t=String(text||"").replace(/```json|```/g,"").trim();
  if(!t)throw {code:"invalid_json"};
  try{return JSON.parse(t)}catch(e){}
  const starts=["{","["].map(c=>t.indexOf(c)).filter(i=>i>=0);
  const a=starts.length?Math.min(...starts):-1;
  const b=Math.max(t.lastIndexOf("}"),t.lastIndexOf("]"));
  if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch(e){}}
  throw {code:"invalid_json"};
}
const AI_TIMEOUT_MS=60000;   // довше за хвилину не чекаємо — показуємо зрозумілу помилку

/**
 * Як зменшити «роздуми» моделі, щоб відповідь приходила швидше.
 * Gemini 3 керується рівнем (thinkingLevel), Gemini 2.5 — бюджетом (thinkingBudget).
 */
function thinkingFor(model){
  if(/gemini-3/i.test(model))return {thinkingLevel:"low"};
  if(/gemini-2\.5/i.test(model))return {thinkingBudget:0};
  return null;
}

/** Одна спроба запиту до конкретної моделі. */
async function requestModel(model,parts,cfg,signal){
  const key=getKey();if(!key)throw {code:"no_key"};
  const genCfg={...cfg};
  const thinking=cfg.fastThinking===false?null:thinkingFor(model);
  delete genCfg.fastThinking;
  if(thinking)genCfg.thinkingConfig=thinking;

  // власний таймер + кнопка «Зупинити» від користувача: спрацює те, що раніше
  const ctl=new AbortController();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;ctl.abort()},AI_TIMEOUT_MS);
  const onUserStop=()=>ctl.abort();
  if(signal){if(signal.aborted)ctl.abort();else signal.addEventListener("abort",onUserStop,{once:true})}

  const send=c=>fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
    method:"POST",signal:ctl.signal,
    headers:{"content-type":"application/json","x-goog-api-key":key},
    body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:c})});
  let res;
  try{
    res=await send(genCfg);
    // якщо модель не прийняла налаштування «роздумів» — повторюємо без них
    if(res.status===400&&genCfg.thinkingConfig){
      const err=await res.clone().json().catch(()=>null);
      console.warn("Модель не прийняла thinkingConfig, повторюю без нього:",err?.error?.message);
      const {thinkingConfig,...rest}=genCfg;res=await send(rest);
    }
  }catch(e){
    if(timedOut)throw {code:"timeout",model};
    if(e?.name==="AbortError")throw {code:"cancelled"};
    throw {code:"network",model,detail:String(e?.message||e)};
  }finally{
    clearTimeout(timer);
    if(signal)signal.removeEventListener("abort",onUserStop);
  }
  if(!res.ok){
    const err=await res.json().catch(()=>null);
    const msg=err?.error?.message||"";
    console.warn("Gemini API error",res.status,model,msg);
    const badKey=res.status===401||res.status===403||/API key|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg);
    const code=badKey?"bad_key":res.status===429?"rate_limited":res.status===404?"no_model":res.status===400?"bad_request":res.status>=500?"overloaded":"upstream_error";
    const e={code,status:res.status,model,detail:msg};
    if(code==="rate_limited"){
      // скільки секунд чекати: з RetryInfo або з тексту «Please retry in 25.3s»
      const raw=JSON.stringify(err||{});
      const info=(err?.error?.details||[]).find(d=>/RetryInfo/.test(d["@type"]||""));
      const secs=parseFloat(info?.retryDelay)||parseFloat((msg.match(/retry in ([\d.]+)\s*s/i)||[])[1]);
      if(secs)e.retryAfter=Math.ceil(secs);
      e.daily=/PerDay/i.test(raw);
    }
    throw e;
  }
  const data=await res.json();
  const cand=data.candidates?.[0];
  if(cand&&["SAFETY","PROHIBITED_CONTENT","BLOCKLIST","IMAGE_SAFETY"].includes(cand.finishReason))throw {code:"refused",model};
  return cand?.content?.parts||[];
}

/**
 * Запит до AI з перебором моделей:
 *  - модель вимкнена (404) → позначаємо її й беремо наступну;
 *  - сервер перевантажений (5xx) → ще одна спроба на тій самій, потім наступна модель.
 * Модель, що спрацювала, запам'ятовується для ролі до кінця сесії.
 */
async function callGemini(role,parts,cfg,signal){
  if(!getKey())throw {code:"no_key"};
  await loadModels();
  let list=candidatesFor(role);
  if(MODELS[role]&&alive(MODELS[role]))list=[MODELS[role],...list.filter(n=>n!==MODELS[role])];
  if(!list.length){await loadModels(true);list=candidatesFor(role)}
  if(!list.length)throw {code:"no_model"};

  let lastErr=null;
  for(const model of list.slice(0,3)){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const out=await requestModel(model,parts,cfg,signal);
        if(MODELS[role]!==model){console.info("Для ролі",role,"тепер модель",model);MODELS[role]=model}
        return out;
      }catch(e){
        lastErr=e;
        if(e.code==="no_model"){markDead(model);break}                       // вимкнена — одразу до наступної
        if(e.code==="overloaded"&&attempt===0){await new Promise(r=>setTimeout(r,1500));continue}
        if(e.code==="overloaded"||e.code==="rate_limited")break;             // у іншої моделі свій ліміт — пробуємо її
        throw e;                                                             // ключ, ліміт, зупинка — далі не пробуємо
      }
    }
  }
  throw lastErr||{code:"no_model"};
}

const AI={
  async json(prompt,opts={}){
    const parts=[];
    for(const b of [].concat(opts.images||[]))parts.push({inline_data:{mime_type:"image/jpeg",data:b instanceof Blob?await blobToB64(b):b}});
    parts.push({text:prompt});
    const out=await callGemini(opts.fast?"fast":"smart",parts,
      {responseMimeType:"application/json",maxOutputTokens:opts.maxTokens||8192,temperature:opts.temperature??0.7},opts.signal);
    return parseJSON(out.map(p=>p.text||"").join(""));
  },
  async image(prompt,images,signal){
    const parts=images.map(b64=>({inline_data:{mime_type:"image/jpeg",data:b64}}));
    parts.push({text:prompt});
    const out=await callGemini("image",parts,{responseModalities:["TEXT","IMAGE"],fastThinking:false},signal);
    const img=out.find(p=>p.inline_data||p.inlineData);
    const d=img?.inline_data||img?.inlineData;
    if(!d)throw {code:"no_image"};
    return "data:"+(d.mime_type||d.mimeType||"image/png")+";base64,"+d.data;
  }
};
function aiCopy(e){
  switch(e?.code){
    case "no_key":return "Спершу додайте API-ключ (кнопка 🔑 угорі).";
    case "bad_key":return "API-ключ не підходить. Перевірте його (кнопка 🔑 угорі).";
    case "rate_limited":return e.daily
      ?"Денний ліміт безкоштовних запитів вичерпано. Спробуйте завтра або скористайтеся іншим ключем."
      :`Безкоштовний ключ дозволяє кілька запитів на хвилину, і їх вичерпано.${e.retryAfter?` Зачекайте ${e.retryAfter} с.`:" Зачекайте хвилину."}`;
    case "no_model":return "Не вдалося знайти доступну модель. Перевірте ключ і інтернет.";
    case "no_image":return "Модель не повернула зображення. Примірка доступна не на всіх тарифах.";
    case "bad_request":return "API відхилив запит. Відкрийте консоль браузера (F12) — там буде причина.";
    case "refused":return "AI не зміг обробити цей запит. Спробуйте інше фото або умови.";
    case "invalid_json":return "AI відповів у незрозумілому форматі. Спробуйте ще раз.";
    case "cancelled":return "Зупинено.";
    case "timeout":return "AI не відповів за хвилину. Спробуйте ще раз — або відкрийте 🔑 і перевірте, яка модель обрана.";
    case "overloaded":return "Сервіс AI зараз перевантажений — Google просить зачекати. Спробуйте ще раз за хвилину.";
    case "network":return "Немає з'єднання з AI. Перевірте інтернет або вимкніть VPN чи блокувальник реклами для цієї сторінки.";
    default:return "Не вдалося отримати відповідь від AI. Спробуйте ще раз.";
  }
}

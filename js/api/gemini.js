/* =========================================================
   SmartWardrobe — шар 4: зовнішній сервіс — Google Gemini
   Усе спілкування з AI. Файл не знає ні про стан, ні про сторінку:
   на вхід — текст і картинки, на вихід — розібрана відповідь або помилка.
   ========================================================= */



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
      .filter(n=>n&&!BAD_MODEL.test(n));
  }catch(e){console.warn("Не вдалося отримати список моделей",e);MODELS.list=[]}
  const has=n=>MODELS.list.includes(n);
  const pick=(prefs,rx)=>prefs.find(has)
    || MODELS.list.find(n=>rx.test(n)&&!/preview|exp/i.test(n))
    || MODELS.list.find(n=>rx.test(n)) || null;
  MODELS.image=pick(MODEL_PREFS.image,/image/i);
  MODELS.smart=pick(MODEL_PREFS.smart,/^(?!.*image).*flash/i)||MODELS.list.find(n=>!/image/i.test(n))||null;
  MODELS.fast=pick(MODEL_PREFS.fast,/flash-lite/i)||MODELS.smart;
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
async function callGemini(role,parts,cfg,signal,retried){
  const key=getKey();if(!key)throw {code:"no_key"};
  await loadModels();
  const model=MODELS[role];
  if(!model)throw {code:"no_model"};
  const send=c=>fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
    method:"POST",signal,
    headers:{"content-type":"application/json","x-goog-api-key":key},
    body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:c})});
  let res;
  try{
    res=await send(cfg);
    // не всі моделі приймають thinkingConfig — тоді повторюємо без нього
    if(res.status===400&&cfg.thinkingConfig){const {thinkingConfig,...rest}=cfg;res=await send(rest)}
  }catch(e){throw {code:e?.name==="AbortError"?"cancelled":"upstream_error"}}
  if(res.status===404&&!retried){
    // назва моделі застаріла — оновлюємо список і пробуємо ще раз
    await loadModels(true);
    if(MODELS[role]&&MODELS[role]!==model)return callGemini(role,parts,cfg,signal,true);
  }
  if(!res.ok){
    const err=await res.json().catch(()=>null);
    const msg=err?.error?.message||"";
    console.warn("Gemini API error",res.status,model,msg);
    const badKey=res.status===401||res.status===403||/API key|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg);
    throw {code:badKey?"bad_key":res.status===429?"rate_limited":res.status===404?"no_model":res.status===400?"bad_request":"upstream_error",detail:msg};
  }
  const data=await res.json();
  const cand=data.candidates?.[0];
  if(cand&&["SAFETY","PROHIBITED_CONTENT","BLOCKLIST","IMAGE_SAFETY"].includes(cand.finishReason))throw {code:"refused"};
  return cand?.content?.parts||[];
}
const AI={
  async json(prompt,opts={}){
    const parts=[];
    for(const b of [].concat(opts.images||[]))parts.push({inline_data:{mime_type:"image/jpeg",data:b instanceof Blob?await blobToB64(b):b}});
    parts.push({text:prompt});
    const out=await callGemini(opts.fast?"fast":"smart",parts,
      {responseMimeType:"application/json",maxOutputTokens:opts.maxTokens||4096,temperature:opts.temperature??0.7,thinkingConfig:{thinkingBudget:0}},opts.signal);
    return parseJSON(out.map(p=>p.text||"").join(""));
  },
  async image(prompt,images,signal){
    const parts=images.map(b64=>({inline_data:{mime_type:"image/jpeg",data:b64}}));
    parts.push({text:prompt});
    const out=await callGemini("image",parts,{responseModalities:["TEXT","IMAGE"]},signal);
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
    case "rate_limited":return "Вичерпано безкоштовний ліміт запитів. Спробуйте за хвилину або завтра.";
    case "no_model":return "Не вдалося знайти доступну модель. Перевірте ключ і інтернет.";
    case "no_image":return "Модель не повернула зображення. Примірка доступна не на всіх тарифах.";
    case "bad_request":return "API відхилив запит. Відкрийте консоль браузера (F12) — там буде причина.";
    case "refused":return "AI не зміг обробити цей запит. Спробуйте інше фото або умови.";
    case "invalid_json":return "AI відповів у незрозумілому форматі. Спробуйте ще раз.";
    case "cancelled":return "Зупинено.";
    default:return "Не вдалося отримати відповідь від AI. Перевірте інтернет і спробуйте ще раз.";
  }
}

/* =========================================================
   SmartWardrobe — шар 6: інтерфейс
   Малює екрани зі стану. Нічого не рахує сам — бере готові числа з Logic
   і ніколи не змінює стан напряму.
   ========================================================= */

/* ---------- Доступ до сторінки та сповіщення ---------- */
const $=s=>document.querySelector(s);
let toastT;
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),3200)}


function setPreview(boxSel,hintSel,src){
  const box=$(boxSel);box.querySelector("img")?.remove();
  $(hintSel).hidden=!!src;
  if(src){const im=document.createElement("img");im.src=src;im.alt="Фото";box.appendChild(im)}
}

let retryTimer=null;
function showAIError(e,el){
  clearInterval(retryTimer);
  if(e?.code==="cancelled"){el.textContent="Зупинено.";el.classList.remove("err");return}
  if(e?.code==="rate_limited"&&e.retryAfter&&!e.daily){
    // зворотний відлік замість сирого тексту від Google
    let left=e.retryAfter;
    const paint=()=>{el.textContent=left>0?`Безкоштовний ключ дозволяє кілька запитів на хвилину, і їх вичерпано. Можна повторити через ${left} с.`:"Можна пробувати знову.";el.classList.toggle("err",left>0)};
    paint();retryTimer=setInterval(()=>{left--;paint();if(left<=0)clearInterval(retryTimer)},1000);
    return;
  }
  if(e?.code==="bad_key"||e?.code==="no_key")renderAIState();
  el.textContent=aiCopy(e);el.classList.add("err");
  // технічна деталь: код відповіді, модель і текст від Google (або текст помилки JavaScript)
  const tech=[e?.status&&`код ${e.status}`,e?.model,e?.detail||(!e?.code&&e?.message)].filter(Boolean).join(" · ");
  if(tech){const d=document.createElement("div");d.className="tech";d.textContent=tech;el.appendChild(d)}
  if(!e?.code)console.error("Неочікувана помилка",e);
}
function renderAIState(){
  const on=!!getKey();
  $("#aiState").textContent=on?"AI-стиліст готовий":"AI вимкнено — додайте ключ";
  $("#genBtn").disabled=!on;
}


/* ---------- Малювання екранів ---------- */
function tagHTML(it,opts={}){
  const c=CATS[it.category]||CATS.top;
  const pic=it.photo?`<img src="${esc(it.photo)}" alt="">`:`<span class="emo" aria-hidden="true">${c.emoji}</span>`;
  const badge=opts.dust&&isForgotten(it)?`<span class="dust">💤</span>`:"";
  const cpw=costPerWear(it);
  const meta=cpw!=null?`${cpw} грн за носіння`:(it.wearCount>0?`вдягали ${it.wearCount} р.`:(it.color||c.label));
  return `<div class="thumb" style="--sw:${hexOk(it.hex)}">${pic}${badge}</div><div class="tname">${esc(it.name)}</div><div class="tmeta">${esc(meta)}</div>`;
}
function renderWardrobe(){
  const box=$("#wardrobeBody");
  if(!state.items.length){
    box.innerHTML=`<div class="empty"><p>Гардероб поки порожній. Додайте першу річ або завантажте приклад, щоб одразу спробувати підбір образів.</p>
      <div class="row"><button class="btn primary" data-act="add">Додати річ</button><button class="btn tape" data-act="demo">Завантажити приклад</button></div></div>`;
    return;
  }
  const counts={};state.items.forEach(i=>counts[i.category]=(counts[i.category]||0)+1);
  const list=state.items.filter(i=>state.filter==="all"||i.category===state.filter).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const totalWears=state.items.reduce((s,i)=>s+(i.wearCount||0),0);
  box.innerHTML=`
    <div class="stats">
      <div class="stat"><b>${state.items.length}${isPremium()?"":`<small style="font-size:.6em;opacity:.6"> / ${PLAN.freeItems}</small>`}</b><span>речей</span></div>
      <div class="stat"><b>${forgottenItems().length}</b><span>давно без діла</span></div>
      <div class="stat"><b>${totalWears}</b><span>носінь</span></div>
    </div>
    <div class="row" style="margin-bottom:14px">
      <button class="btn primary" data-act="add" style="flex:1">＋ Додати річ</button>
      <button class="btn tape" data-act="buy" style="flex:1">🛍️ Купувати?${canUse("buy")?"":`<span class="pro">Premium</span>`}</button>
    </div>
    <div class="chips" role="group" aria-label="Фільтр за категорією">
      <button class="chip" data-filter="all" aria-pressed="${state.filter==="all"}">Усе</button>
      ${Object.entries(CATS).filter(([k])=>counts[k]).map(([k,c])=>`<button class="chip" data-filter="${k}" aria-pressed="${state.filter===k}">${c.label} · ${counts[k]}</button>`).join("")}
    </div>
    <div class="grid">${list.map(it=>`<button class="tag" data-item="${esc(it.id)}" aria-label="${esc(it.name)}, редагувати">${tagHTML(it,{dust:true})}</button>`).join("")}</div>`;
}
function lookHTML(o,opts){
  const items=(o.items||[]).map(itemById).filter(Boolean);
  if(!items.length)return "";
  const meta=opts.meta?`<div class="meta">${esc(opts.meta)}</div>`:"";
  return `<article class="look ${opts.fresh?"fresh":""}">
    <h2>${esc(o.title)}</h2>${meta}
    <div class="rail">${items.map(it=>`<div class="hang"><div class="tag">${tagHTML(it)}</div></div>`).join("")}</div>
    ${o.why?`<p>${esc(o.why)}</p>`:""}${o.tip?`<p class="tip">Порада: ${esc(o.tip)}</p>`:""}
    <div class="row">${opts.actions}</div></article>`;
}
function renderResults(fresh){
  const r=state.results,box=$("#results");
  if(!r){box.innerHTML="";return}
  const label=[r.city,tempLabel(r.temp),r.weather,r.event].filter(Boolean).join(", ");
  box.innerHTML=(r.missing?`<div class="missing"><b>Чого бракує гардеробу</b>${esc(r.missing)}
      <button class="btn sm" data-act="shop" style="margin-top:10px">Підібрати, де купити</button></div>`:"")+
    r.outfits.map((o,i)=>lookHTML(o,{fresh,meta:label,
      actions:`<button class="btn tape sm" data-save="${i}">${o.saved?"Збережено ✓":"Зберегти"}</button>
               <button class="btn sm" data-wear-res="${i}">Вдягну сьогодні</button>
               <button class="btn sm" data-try-res="${i}">Приміряти${canUse("tryon")?"":`<span class="pro">Premium</span>`}</button>`})).join("")+
    `<button class="btn block" id="moreBtn">Інші варіанти</button>`;
}
function renderSaved(){
  const box=$("#savedBody");
  const list=[...state.outfits].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!list.length){box.innerHTML=`<div class="empty"><p>Тут з'являться образи, які ви збережете після підбору.</p><button class="btn primary" data-goto="outfit">Підібрати образ</button></div>`;return}
  box.innerHTML=list.map(o=>lookHTML(o,{meta:[o.city,o.event,o.temp!=null?tempLabel(o.temp):"",o.weather].filter(Boolean).join(", "),
    actions:`<button class="btn tape sm" data-wear-saved="${esc(o.id)}">Вдягну сьогодні</button>
             <button class="btn sm" data-try-saved="${esc(o.id)}">Приміряти${canUse("tryon")?"":`<span class="pro">Premium</span>`}</button>
             <button class="btn ghost danger sm" data-del-outfit="${esc(o.id)}">Видалити</button>`})).join("");
}
function renderMe(){
  const {cur,next}=levelOf(state.points);
  const pct=next?Math.min(100,Math.round((state.points-cur.p)/(next.p-cur.p)*100)):100;
  const p=state.profile;
  const forgotten=forgottenItems().slice(0,8);
  const u=state.user||blankUser();
  const gender=GENDERS.find(g=>g[0]===u.gender)?.[1]||"—";
  const quizTxt=QUIZ.map(q=>{
    const v=u.quiz?.[q.id];
    const txt=Array.isArray(v)?v.map(x=>QUIZ_LABEL[q.id+":"+x]).join(", "):(v?QUIZ_LABEL[q.id+":"+v]:"");
    return txt?`<div><span>${esc(q.q)}</span><b>${esc(txt)}</b></div>`:"";
  }).join("");
  $("#meBody").innerHTML=`
    <div class="card">
      <div class="me-head">
        ${avatarHTML(u,72)}
        <div>
          <b class="me-name">${esc(u.name||"Без імені")}</b>
          <div class="row" style="margin-top:8px">
            <label class="btn sm" style="cursor:pointer">${u.avatar?"Змінити аватар":"Додати аватар"}<input type="file" accept="image/*" id="avatarIn" hidden></label>
            ${u.avatar?`<button class="btn ghost danger sm" data-act="avatar-del">Прибрати</button>`:""}
          </div>
        </div>
      </div>
      <h3>Акаунт</h3>
      <div class="summary">
        <div><span>Ім'я</span><b>${esc(u.name||"—")}</b></div>
        <div><span>Email</span><b>${esc(u.email||"—")}</b></div>
        <div><span>Телефон</span><b>${esc(u.phone||"—")}</b></div>
        <div><span>Вік і стать</span><b>${esc([u.age,gender!=="—"?gender:""].filter(Boolean).join(", ")||"—")}</b></div>
        <div><span>Зріст і розміри</span><b>${esc([u.height&&u.height+" см",u.sizeTop,u.sizeShoe].filter(Boolean).join(", ")||"—")}</b></div>
        <div><span>Місто</span><b>${esc(state.city||"—")}</b></div>
      </div>
      ${quizTxt?`<h3 style="margin-top:14px">Анкета стилю</h3><div class="summary">${quizTxt}</div>`:""}
      <div class="row"><button class="btn" data-act="edit-profile" style="flex:1">Редагувати анкету</button>
      <button class="btn ghost danger" data-act="reset">Скинути все</button></div>
    </div>

    <div class="plan ${isPremium()?"on":""}">
      <h3>${isPremium()?"У вас Premium ✨":"Безкоштовний тариф"}</h3>
      ${isPremium()
        ?`<p style="margin:0 0 12px;font-size:.92rem">Безлімітний гардероб, до ${PLAN.premiumStyles} стилів в анкеті та всі функції відкриті.</p>
          <button class="btn sm" data-act="plan-off">Повернутися на безкоштовний (демо)</button>`
        :`<p class="lead" style="margin:0 0 10px">До ${PLAN.freeItems} речей і ${PLAN.freeStyles} стиль в анкеті. Premium відкриває більше:</p>
          <ul class="perks">${premiumPerks()}</ul>
          <button class="btn tape block" data-act="paywall">Premium за ${PLAN.price} грн / міс</button>`}
    </div>

    <div class="level">
      <div class="lv">${esc(cur.name)}</div>
      <div class="pts">${state.points} балів${next?` · до рівня ${esc(next.name)} ще ${next.p-state.points}`:" · максимальний рівень"}</div>
      <div class="meter"><i style="width:${pct}%"></i></div>
    </div>

    <div class="card">
      <h3>Профіль стилю</h3>
      ${p?`<p style="margin:0 0 6px"><b>${esc(p.style)}</b></p>
          <p style="margin:0 0 6px;font-size:.9rem">Улюблені кольори: ${esc(p.colors)}</p>
          <p style="margin:0 0 6px;font-size:.9rem">Найчастіше носите: ${esc(p.favorite)}</p>
          <p class="lead" style="margin:8px 0 0">${esc(p.advice)}</p>`
        :`<p class="lead" style="margin:0 0 10px">AI проаналізує ваш гардероб і опише ваш стиль, а далі підбиратиме образи саме під нього.</p>`}
      <div class="status" id="profStatus" role="status" aria-live="polite"></div>
      <button class="btn block" data-act="profile">${p?"Оновити аналіз":"Проаналізувати мій стиль"}</button>
    </div>

    <div class="card">
      <h3>Челенджі</h3>
      ${CHALLENGES.map(ch=>{
        const st=state.challenges[ch.id];
        const val=st?Math.min(ch.goal,challengeProgress(ch)):0;
        const done=val>=ch.goal;
        return `<div class="ch">
          <b>${esc(ch.title)}</b><small>${esc(ch.hint)}</small>
          ${st?`<div class="meter"><i style="width:${Math.round(val/ch.goal*100)}%"></i></div>
                <div class="bot"><span class="cnt">${val} з ${ch.goal}</span>
                ${st.claimed?`<span class="done">Пройдено ✓</span>`
                  :done?`<button class="btn tape sm" data-claim="${ch.id}">Забрати ${ch.points} балів</button>`
                  :`<span class="cnt">+${ch.points} балів</span>`}</div>`
            :`<div class="bot"><span class="cnt">+${ch.points} балів</span><button class="btn sm" data-start="${ch.id}">Почати</button></div>`}
        </div>`}).join("")}
    </div>

    <div class="card">
      <h3>Забуті речі</h3>
      ${forgotten.length?`<p class="lead" style="margin:0 0 4px">Ці речі давно не були в образах. Натисніть, щоб знайти нові комбінації.</p>
        <div class="rail" style="padding-top:22px">${forgotten.map(it=>`<div class="hang"><button class="tag" data-revive="${esc(it.id)}" aria-label="Знайти образи з ${esc(it.name)}">${tagHTML(it)}</button></div>`).join("")}</div>`
        :`<p class="lead" style="margin:0">Чудово: усі речі були в ділі за останні ${FORGOT_DAYS} днів.</p>`}
    </div>

    <div class="card">
      <h3>Що докупити</h3>
      <p class="lead" style="margin:0 0 10px">AI знайде речі, яких бракує саме вашому гардеробу, і покаже, де їх шукати.</p>
      <button class="btn block" data-act="shop">Підібрати, чого бракує</button>
    </div>

    <div class="card">
      <h3>Розумна валіза</h3>
      <p class="lead" style="margin:0 0 10px">Поїздка на кілька днів? AI складе образи за прогнозом погоди й мінімумом речей.</p>
      <button class="btn block" data-act="pack">Спакувати валізу${canUse("pack")?"":`<span class="pro">Premium</span>`}</button>
    </div>

    <div class="card">
      <h3>Фото для примірки</h3>
      <p class="lead" style="margin:0 0 10px">Потрібне для функції «Приміряти» на картці образу. Зберігається лише у вашому браузері.</p>
      ${state.userPhoto?`<div class="tryout"><img src="${esc(state.userPhoto)}" alt="Ваше фото"></div>`:""}
      <label class="btn block" style="cursor:pointer">${state.userPhoto?"Замінити фото":"Завантажити фото"}<input type="file" accept="image/*" id="meIn" hidden></label>
    </div>`;
}


/* ---------- Перемальовування після зміни стану ---------- */
/* ---------- Аватар ---------- */
/** Кругла аватарка: фото, якщо є, інакше ініціали. */
function avatarHTML(u,size){
  const s=size||44;
  const inner=u&&u.avatar?`<img src="${esc(u.avatar)}" alt="">`:`<span>${esc(initials(u&&u.name))}</span>`;
  return `<span class="avatar" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.38)}px">${inner}</span>`;
}
/** Перелік переваг Premium — з конфігурації, щоб не дублювати тексти. */
function premiumPerks(){
  return [`Безлімітний гардероб замість ${PLAN.freeItems} речей`,`До ${PLAN.premiumStyles} стилів в анкеті замість ${PLAN.freeStyles}`,...Object.values(PLAN.premiumOnly)]
    .map(t=>`<li>${esc(t)}</li>`).join("");
}
function renderHeaderAvatar(){
  const b=$("#meAvatar");if(!b)return;
  const u=state.user;
  b.hidden=!(u&&u.done);
  b.innerHTML=avatarHTML(u,34).replace('class="avatar"',isPremium()?'class="avatar ring"':'class="avatar"');
  b.setAttribute("aria-label",u&&u.name?`Профіль: ${u.name}`:"Профіль");
}

function renderAll(){renderWardrobe();renderSaved();renderMe();renderHeaderAvatar()}

/* ---------- Кнопки вибору події та погоди ---------- */
function renderChoiceChips(){
  $("#events").innerHTML=EVENTS.map(e=>`<button class="chip" role="radio" aria-checked="${state.event===e}" data-ev="${e}">${e}</button>`).join("");
  $("#weather").innerHTML=WEATHER.map(w=>`<button class="chip" role="radio" aria-checked="${state.weather===w}" data-wx="${w}">${w}</button>`).join("");
}

/* ---------- Вкладки ---------- */
function showTab(name){
  document.querySelectorAll("[role=tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===name)));
  ["wardrobe","outfit","saved","me"].forEach(t=>$("#tab-"+t).hidden=t!==name);
  window.scrollTo({top:0});
}
document.querySelectorAll("[role=tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));


/* ---------- Робота з фото ---------- */
async function loadImage(file){
  try{return await createImageBitmap(file,{imageOrientation:"from-image"})}
  catch(e){return await new Promise((res,rej)=>{const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(e);im.src=u})}
}
/** Обрізає фото до квадрата по центру — для аватара. */
function toSquare(img,size){
  const side=Math.min(img.width,img.height);
  const c=document.createElement("canvas");c.width=size;c.height=size;
  c.getContext("2d").drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,size,size);
  return c;
}
function toCanvas(img,max){
  const w=img.width,h=img.height,s=Math.min(1,max/Math.max(w,h));
  const c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c;
}
const toBlob=(canvas,q)=>new Promise(r=>canvas.toBlob(r,"image/jpeg",q));


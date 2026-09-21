/* =========================================================
   SmartWardrobe — шар 7: застосунок
   Склеює все докупи: діалоги, обробники подій, сценарії функцій і запуск.
   ========================================================= */

/* ---------- Діалог речі ---------- */
const itemDlg=$("#itemDlg");
$("#fCat").innerHTML=Object.entries(CATS).map(([k,c])=>`<option value="${k}">${c.label}</option>`).join("");
$("#fStyle").innerHTML=Object.entries(STYLES).map(([k,s])=>`<option value="${k}">${s}</option>`).join("");
$("#fSeasons").innerHTML=Object.entries(SEASONS).map(([k,s])=>`<label><input type="checkbox" value="${k}">${s}</label>`).join("");
$("#fWarm").oninput=e=>$("#fWarmOut").textContent=e.target.value;

function fillForm(it){
  $("#fName").value=it.name||"";$("#fCat").value=CATS[it.category]?it.category:"top";$("#fStyle").value=STYLES[it.style]?it.style:"casual";
  $("#fColor").value=it.color||"";$("#fHex").value=hexOk(it.hex);$("#fPrice").value=it.price||"";
  document.querySelectorAll("#fSeasons input").forEach(c=>c.checked=(it.seasons||[]).includes(c.value));
  const w=Math.min(5,Math.max(1,Number(it.warmth)||2));
  $("#fWarm").value=w;$("#fWarmOut").textContent=w;
}
function openItem(id){
  if(!id&&state.items.length>=itemLimit())
    return openPaywall(`Безкоштовно можна зберегти до ${PLAN.freeItems} речей. У Premium гардероб безлімітний.`);
  const it=id?itemById(id):null;
  state.editing=it;state.draftPhoto=it?.photo||null;
  $("#dlgTitle").textContent=it?"Редагувати річ":"Нова річ";
  $("#delItem").hidden=!it;
  $("#aiStatus").textContent="";$("#aiStatus").classList.remove("err");
  const cpw=it?costPerWear(it):null;
  $("#cpwStatus").textContent=it?`Вдягали ${it.wearCount||0} разів${cpw!=null?`, вартість одного носіння ${cpw} грн`:""}`:"";
  $("#photoIn").value="";setPreview("#photoBox","#photoHint",state.draftPhoto);
  fillForm(it||{seasons:["spring","autumn"]});
  itemDlg.showModal();
}
$("#cancelItem").onclick=()=>itemDlg.close();
$("#saveItem").onclick=()=>{
  const name=$("#fName").value.trim();
  if(!name){const st=$("#aiStatus");st.textContent="Вкажіть назву речі.";st.classList.add("err");$("#fName").focus();return}
  const base=state.editing||{id:newId(),createdAt:Date.now(),wearCount:0};
  const it={...base,name,category:$("#fCat").value,style:$("#fStyle").value,color:$("#fColor").value.trim(),hex:$("#fHex").value,
    price:Number($("#fPrice").value)||0,seasons:[...document.querySelectorAll("#fSeasons input:checked")].map(c=>c.value),
    warmth:Number($("#fWarm").value),photo:state.draftPhoto||null};
  const isNew=!state.editing;
  if(isNew&&state.items.length>=itemLimit()){itemDlg.close();return openPaywall(`Безкоштовно можна зберегти до ${PLAN.freeItems} речей.`)}
  const i=state.items.findIndex(x=>x.id===it.id);
  if(i>=0)state.items[i]=it;else state.items.push(it);
  if(!Store.update()){if(i<0)state.items.pop();return}
  if(isNew)addPoints(5,"Річ додано.");
  Store.update();itemDlg.close();
  toast(isNew?"Річ додано в гардероб":"Зміни збережено");
};
$("#delItem").onclick=()=>{
  if(!state.editing||!confirm("Видалити цю річ з гардеробу?"))return;
  state.items=state.items.filter(x=>x.id!==state.editing.id);
  Store.update();itemDlg.close();toast("Річ видалено");
};


$("#photoIn").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const st=$("#aiStatus");st.classList.remove("err");
  let img;
  try{img=await loadImage(file)}catch(err){st.textContent="Це фото не вдалося відкрити. Спробуйте JPG або PNG.";st.classList.add("err");return}
  state.draftPhoto=toCanvas(img,360).toDataURL("image/jpeg",0.72);
  setPreview("#photoBox","#photoHint",state.draftPhoto);
  if(!getKey()){st.textContent="Без ключа AI — заповніть поля вручну.";return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> AI розпізнає річ…`;
  try{
    const blob=await toBlob(toCanvas(img,1024),0.85);
    const r=await AI.json(RECOGNIZE_PROMPT,{images:[blob],fast:true,temperature:0.2,maxTokens:600});
    if(r?.error){st.textContent="Схоже, на фото немає одягу. Спробуйте інше фото або заповніть поля вручну.";st.classList.add("err");return}
    fillForm({...r,seasons:Array.isArray(r.seasons)?r.seasons.filter(s=>SEASONS[s]):[]});
    st.textContent="Готово. Перевірте поля й збережіть.";
  }catch(err){showAIError(err,st)}
};


const RECOGNIZE_PROMPT=`На фото одна річ одягу, взуття або аксесуар. Визнач її.
Відповідай лише JSON-об'єктом:
{"name":"коротка назва українською, 2-4 слова, з малої літери","category":"top|bottom|dress|outer|shoes|acc","color":"основний колір українською","hex":"#rrggbb","style":"casual|office|sport|evening|street","seasons":["spring","summer","autumn","winter"],"warmth":1}
Пояснення: top = футболки, сорочки, светри, худі; bottom = штани, джинси, спідниці, шорти; dress = сукні та комбінезони; outer = куртки, пальта, тренчі, піджаки; shoes = взуття; acc = сумки, шарфи, шапки, прикраси. warmth від 1 (дуже легка) до 5 (для морозу). seasons — лише ті, коли річ доречна.
Якщо на фото немає одягу, поверни {"error":"not_clothing"}.`;

/* ---------- Онбординг: реєстрація, параметри, анкета стилю ---------- */

const OB={i:0,edit:false};
const obEl=$("#ob");

function obSteps(){
  const q=QUIZ.map(x=>"quiz:"+x.id);
  return OB.edit?["account","params",...q,"photo","done"]:["welcome","account","params",...q,"photo","done"];
}
function startOnboarding(edit){
  OB.edit=!!edit;OB.i=0;
  if(!state.user)state.user=blankUser();
  obEl.hidden=false;obRender();
}
function obRender(){
  const steps=obSteps(),key=steps[OB.i],u=state.user;
  $("#obDots").innerHTML=steps.map((_,i)=>`<i class="${i<=OB.i?"on":""}"></i>`).join("");
  $("#obBack").hidden=OB.i===0;
  $("#obSkip").hidden=!(key.startsWith("quiz:")||key==="photo");
  $("#obNext").textContent=key==="done"?(OB.edit?"Зберегти":"Почати користуватися"):(key==="welcome"?"Створити акаунт":"Далі");
  const body=$("#obBody");

  if(key==="welcome"){
    body.innerHTML=`<div class="hero-tape"></div>
      <h2>Повна шафа, а вдягнути нічого?</h2>
      <p class="lead">SmartWardrobe оцифровує ваш гардероб і щодня збирає образи саме з ваших речей.</p>
      <ul>
        <li>AI розпізнає одяг з фото — заповнювати нічого не треба</li>
        <li>Образи враховують погоду у вашому місті та подію</li>
        <li>Перед покупкою скаже, скільки нових образів додасть річ</li>
        <li>Нагадає про речі, які лежать без діла</li>
      </ul>
      <p class="privacy">Це навчальний прототип. Усі дані залишаються у вашому браузері й нікуди не надсилаються.</p>`;
  }
  else if(key==="account"){
    body.innerHTML=`<h2>Створення акаунта</h2>
      <p class="lead">Щоб зберігати ваш гардероб і прогрес.</p>
      <div class="ob-avatar">
        ${avatarHTML(u,64)}
        <label class="btn sm" style="cursor:pointer">${u.avatar?"Змінити аватар":"Додати аватар"}<input type="file" accept="image/*" id="obAvatarIn" hidden></label>
      </div>
      <label class="fl"><span>Ім'я *</span><input type="text" id="uName" maxlength="40" value="${esc(u.name)}" placeholder="Марія"></label>
      <label class="fl"><span>Email *</span><input type="text" id="uEmail" maxlength="60" value="${esc(u.email)}" placeholder="maria@example.com" inputmode="email"></label>
      <label class="fl"><span>Номер телефону</span><input type="text" id="uPhone" maxlength="20" value="${esc(u.phone)}" placeholder="+380 __ ___ __ __" inputmode="tel"></label>
      <label class="fl" style="max-width:48%"><span>Вік</span><input type="number" id="uAge" min="10" max="100" value="${esc(u.age)}" placeholder="22"></label>
      <div class="fl"><span>Стать</span></div>
      <div class="opts">${GENDERS.map(([v,l,e])=>`<button class="opt" data-gender="${v}" aria-pressed="${u.gender===v}"><em>${e}</em>${l}</button>`).join("")}</div>
      <p class="privacy">Пароля немає: це прототип без сервера. Дані зберігаються лише у вашому браузері.</p>
      <div class="status" id="obErr"></div>`;
  }
  else if(key==="params"){
    body.innerHTML=`<h2>Ваші параметри</h2>
      <p class="lead">Потрібні для порад щодо посадки й для примірки. Усе необов'язкове.</p>
      <div class="frow">
        <label class="fl"><span>Зріст, см</span><input type="number" id="uHeight" min="120" max="220" value="${esc(u.height)}" placeholder="170"></label>
        <label class="fl"><span>Розмір одягу</span><input type="text" id="uSizeTop" maxlength="6" value="${esc(u.sizeTop)}" placeholder="M"></label>
      </div>
      <div class="frow">
        <label class="fl"><span>Розмір взуття</span><input type="text" id="uSizeShoe" maxlength="6" value="${esc(u.sizeShoe)}" placeholder="38"></label>
        <label class="fl"><span>Місто</span><input type="text" id="uCity" maxlength="40" value="${esc(state.city)}" placeholder="Львів"></label>
      </div>
      <p class="privacy">Місто потрібне, щоб застосунок сам підтягував погоду для образів.</p>`;
  }
  else if(key.startsWith("quiz:")){
    const q=QUIZ.find(x=>x.id===key.slice(5));
    const cur=asList(u.quiz[q.id]);
    const limit=q.max==="styles"?styleLimit():0;
    // плитки з фоном — для питань, де вибір візуальний; довгі підписи — у широкі плитки
    const wide=q.opts.some(o=>o[1].length>22);
    body.innerHTML=`<h2>${esc(q.q)}</h2><p class="lead">${esc(q.lead)}</p>
      <div class="tiles ${wide?"wide":""}">${q.opts.map(([v,l,e,sw])=>`
        <button class="tile" style="--sw:${sw||"var(--surface)"}" data-quiz="${q.id}" data-val="${v}" aria-pressed="${cur.includes(v)}">
          <span class="tick" aria-hidden="true">✓</span>
          <span class="tl"><em aria-hidden="true">${e}</em>${esc(l)}</span>
        </button>`).join("")}</div>
      ${limit?`<p class="limit-note">Обрано ${cur.length} з ${limit}.${isPremium()?"":` У Premium — до ${PLAN.premiumStyles} стилів. <button class="btn ghost sm" data-act="paywall">Спробувати</button>`}</p>`:""}`;
  }
  else if(key==="photo"){
    body.innerHTML=`<h2>Фото для примірки</h2>
      <p class="lead">Потрібне, щоб приміряти зібрані образи на себе. Можна додати пізніше в профілі.</p>
      <label class="photo" id="obPhotoBox"><input type="file" accept="image/*" id="obPhotoIn"><span id="obPhotoHint">Фото на весь зріст, бажано на світлому фоні</span></label>
      <p class="privacy">Фото зберігається лише у вашому браузері. Для примірки воно надсилається до AI у момент запиту й не зберігається на сервері.</p>`;
    if(state.userPhoto)setPreview("#obPhotoBox","#obPhotoHint",state.userPhoto);
  }
  else if(key==="done"){
    const qs=QUIZ.map(q=>{
      const v=u.quiz[q.id];
      const txt=Array.isArray(v)?v.map(x=>QUIZ_LABEL[q.id+":"+x]).join(", "):(v?QUIZ_LABEL[q.id+":"+v]:"—");
      return `<div><span>${esc(q.q)}</span><b>${esc(txt||"—")}</b></div>`;
    }).join("");
    body.innerHTML=`<h2>Готово, ${esc(u.name||"друже")}!</h2>
      <p class="lead">Ось що застосунок про вас знає. Усе це враховуватиметься в підборі образів.</p>
      <div class="summary">
        <div><span>Email</span><b>${esc(u.email||"—")}</b></div>
        <div><span>Вік і стать</span><b>${esc([u.age,GENDERS.find(g=>g[0]===u.gender)?.[1]].filter(Boolean).join(", ")||"—")}</b></div>
        <div><span>Зріст і розміри</span><b>${esc([u.height&&u.height+" см",u.sizeTop,u.sizeShoe].filter(Boolean).join(", ")||"—")}</b></div>
        <div><span>Місто</span><b>${esc(state.city||"—")}</b></div>
        <div><span>Фото для примірки</span><b>${state.userPhoto?"додано":"—"}</b></div>
      </div>
      <div class="summary">${qs}</div>`;
  }
  obEl.scrollTop=0;
}
function obCollect(){
  const key=obSteps()[OB.i],u=state.user;
  if(key==="account"){
    u.name=$("#uName").value.trim();u.email=$("#uEmail").value.trim();
    u.phone=$("#uPhone").value.trim();u.age=$("#uAge").value.trim();
  }
  if(key==="params"){
    u.height=$("#uHeight").value.trim();u.sizeTop=$("#uSizeTop").value.trim();
    u.sizeShoe=$("#uSizeShoe").value.trim();state.city=$("#uCity").value.trim();
  }
}
function obValidate(){
  const key=obSteps()[OB.i],u=state.user,err=$("#obErr");
  if(key!=="account")return true;
  if(!u.name){err.textContent="Вкажіть ім'я.";err.classList.add("err");return false}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)){err.textContent="Перевірте email — схоже, там помилка.";err.classList.add("err");return false}
  return true;
}
$("#obNext").onclick=()=>{
  obCollect();
  if(!obValidate())return;
  const steps=obSteps();
  if(OB.i>=steps.length-1){
    state.user.done=true;
    if(!OB.edit)addPoints(20,"Акаунт створено.");
    Store.update();obEl.hidden=true;$("#city").value=state.city;
    toast(OB.edit?"Анкету оновлено":"Вітаємо у SmartWardrobe!");
    return;
  }
  OB.i++;Store.update();obRender();
};
$("#obBack").onclick=()=>{obCollect();if(OB.i>0){OB.i--;obRender()}};
$("#obSkip").onclick=()=>{obCollect();OB.i++;obRender()};
obEl.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(!b.dataset.gender&&!b.dataset.quiz)return;
  obCollect(); // зберігаємо вже введені поля, інакше перемальовування їх зітре
  if(b.dataset.gender){state.user.gender=b.dataset.gender;obRender()}
  else if(b.dataset.quiz){
    const q=QUIZ.find(x=>x.id===b.dataset.quiz),v=b.dataset.val,u=state.user;
    if(q.multi){
      const cur=asList(u.quiz[q.id]);
      const limit=q.max==="styles"?styleLimit():Infinity;
      if(cur.includes(v))u.quiz[q.id]=cur.filter(x=>x!==v);
      else if(cur.length<limit)u.quiz[q.id]=[...cur,v];
      else if(limit===1)u.quiz[q.id]=[v];      // один стиль — просто замінюємо вибір
      else{toast(`Можна обрати до ${limit} стилів`);return}
      if(limit===1&&!isPremium()&&cur.length&&!cur.includes(v))toast(`У Premium можна обрати до ${PLAN.premiumStyles} стилів`);
    }else u.quiz[q.id]=v;
    obRender();
  }
});
obEl.addEventListener("change",async e=>{
  if(e.target.id!=="obPhotoIn")return;
  const file=e.target.files?.[0];if(!file)return;
  try{
    const img=await loadImage(file);
    state.userPhoto=toCanvas(img,700).toDataURL("image/jpeg",0.8);
    Store.update();setPreview("#obPhotoBox","#obPhotoHint",state.userPhoto);
  }catch(err){toast("Це фото не вдалося відкрити.")}
});


/* ---------- Підбір образів ---------- */
$("#temp").oninput=e=>$("#tempOut").textContent=tempLabel(Number(e.target.value));
$("#city").oninput=e=>{state.city=e.target.value};
$("#wxBtn").onclick=async()=>{
  const st=$("#wxStatus");st.classList.remove("err");
  const name=$("#city").value.trim();
  if(!name){st.textContent="Впишіть місто.";st.classList.add("err");return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Дивлюся погоду…`;
  try{
    const w=await currentWeather(name);
    state.city=w.city;state.weather=w.weather;
    $("#city").value=w.city;$("#temp").value=w.temp;$("#tempOut").textContent=tempLabel(w.temp);
    renderChoiceChips();Store.update();
    st.textContent=`${w.city}: ${tempLabel(w.temp)}, ${w.weather.toLowerCase()}`;
  }catch(e){st.textContent=e.message==="notfound"?"Такого міста не знайшлося. Спробуйте іншу назву.":"Не вдалося отримати погоду. Перевірте інтернет.";st.classList.add("err")}
};

async function generate(opts={}){
  const st=$("#genStatus");st.classList.remove("err");
  if(!getKey()){st.textContent="Спершу додайте API-ключ (кнопка 🔑 угорі).";st.classList.add("err");return}
  if(state.items.length<3){st.innerHTML=`Для підбору потрібно хоча б 3 речі. <button class="btn ghost sm" data-goto="wardrobe">Додати речі</button>`;return}
  const temp=Number($("#temp").value);
  const force=opts.forceItem?itemById(opts.forceItem):null;
  const prompt=Prompts.outfits({
    event:state.event,temp:tempLabel(temp),weather:state.weather,city:state.city,
    profile:state.profile,force,catalog:catalogText(state.items)
  });
  state.ctl?.abort();state.ctl=new AbortController();
  $("#genBtn").disabled=true;$("#stopBtn").hidden=false;
  const started=Date.now();
  const tick=()=>{st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Стиліст переглядає ваш гардероб… ${Math.round((Date.now()-started)/1000)} с`};
  tick();const ticker=setInterval(tick,1000);
  try{
    const r=await AI.json(prompt,{signal:state.ctl.signal,temperature:opts.fresh?1:0.7});
    const known=new Set(state.items.map(i=>i.id));
    const outfits=(Array.isArray(r?.outfits)?r.outfits:[]).map(o=>({
      title:String(o.title||"Образ"),why:String(o.why||""),tip:String(o.tip||""),
      items:[...new Set((Array.isArray(o.items)?o.items:[]).map(String))].filter(id=>known.has(id))
    })).filter(o=>o.items.length>=2);
    if(!outfits.length){st.textContent="Не вдалося скласти образи з цих речей. Додайте більше одягу або змініть умови.";st.classList.add("err");return}
    state.results={outfits,missing:String(r.missing||""),event:state.event,temp,weather:state.weather,city:state.city};
    st.textContent="";renderResults(true);
  }catch(e){showAIError(e,st)}
  finally{clearInterval(ticker);$("#genBtn").disabled=!getKey();$("#stopBtn").hidden=true}
}
$("#genBtn").onclick=()=>generate();
$("#stopBtn").onclick=()=>state.ctl?.abort();


/* ---------- Профіль стилю ---------- */
async function analyseStyle(){
  const st=$("#profStatus");if(!st)return;
  st.classList.remove("err");
  if(!getKey()){st.textContent=aiCopy({code:"no_key"});st.classList.add("err");return}
  if(state.items.length<5){st.textContent="Додайте хоча б 5 речей, щоб аналіз був змістовним.";st.classList.add("err");return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> AI вивчає ваш гардероб…`;
  try{
    const r=await AI.json(Prompts.style(catalogText(state.items)),{temperature:0.5,maxTokens:800});
    state.profile={style:String(r.style||"—"),colors:String(r.colors||"—"),favorite:String(r.favorite||"—"),advice:String(r.advice||""),at:Date.now()};
    addPoints(15,"Профіль стилю готовий.");Store.update();
  }catch(e){showAIError(e,st)}
}


/* ---------- Купувати чи ні ---------- */
const buyDlg=$("#buyDlg");
function openBuy(){
  if(!canUse("buy"))return openPaywall("«Купувати чи ні?» — функція Premium: сфотографуйте річ у магазині, і AI порівняє її з вашим гардеробом.");
  state.buyBlob=null;
  $("#buyIn").value="";$("#buyPrice").value="";$("#buyResult").innerHTML="";
  $("#buyStatus").textContent="";$("#buyStatus").classList.remove("err");
  $("#buyGo").disabled=true;$("#buyGo").textContent="Оцінити покупку";
  setPreview("#buyBox","#buyHint",null);
  buyDlg.showModal();
}
$("#buyClose").onclick=()=>buyDlg.close();

$("#buyIn").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const st=$("#buyStatus");st.classList.remove("err");$("#buyResult").innerHTML="";
  let img;
  try{img=await loadImage(file)}catch(err){st.textContent="Це фото не вдалося відкрити.";st.classList.add("err");return}
  setPreview("#buyBox","#buyHint",toCanvas(img,360).toDataURL("image/jpeg",0.72));
  state.buyBlob=await toBlob(toCanvas(img,1024),0.85);
  $("#buyGo").disabled=false;$("#buyGo").textContent="Оцінити покупку";
  st.textContent="Впишіть ціну (якщо знаєте) і натисніть «Оцінити покупку».";
};
// ціна впливає на вердикт, тому після її зміни результат треба перерахувати
$("#buyPrice").oninput=()=>{
  if(!state.buyBlob)return;
  $("#buyGo").disabled=false;
  if($("#buyResult").innerHTML){
    $("#buyGo").textContent="Перерахувати з новою ціною";
    $("#buyResult").style.opacity=".45";
  }
};

$("#buyGo").onclick=async()=>{
  const st=$("#buyStatus");st.classList.remove("err");
  if(!state.buyBlob){st.textContent="Спершу додайте фото речі.";st.classList.add("err");return}
  if(!getKey()){st.textContent=aiCopy({code:"no_key"});st.classList.add("err");return}
  if(state.items.length<4){st.textContent="Спершу оцифруйте хоча б 4 речі, інакше порівнювати нема з чим.";st.classList.add("err");return}
  const price=Number($("#buyPrice").value)||0;
  $("#buyGo").disabled=true;
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Порівнюю з вашим гардеробом…`;
  // середня ціна гардеробу — орієнтир, дорога ця річ для цієї людини чи ні
  const priced=state.items.filter(i=>i.price>0);
  const avg=priced.length?Math.round(priced.reduce((a,i)=>a+i.price,0)/priced.length):0;

  try{
    const r=await AI.json(Prompts.buy({price,avg,catalog:catalogText(state.items)}),
      {images:[state.buyBlob],temperature:0.3});
    const cat=CATS[r.category]?r.category:"top";
    const known=new Set(state.items.map(i=>i.id));
    const similar=(Array.isArray(r.similar)?r.similar:[]).filter(id=>known.has(String(id)));
    const combos=newCombos(cat);
    const outfits=(Array.isArray(r.outfits)?r.outfits:[]).map(o=>({title:String(o.title||"Образ"),why:String(o.why||""),
      items:[...new Set((Array.isArray(o.items)?o.items:[]).map(String))].filter(id=>known.has(id))})).filter(o=>o.items.length);
    const vClass={buy:"v-buy",maybe:"v-maybe",skip:"v-skip"}[r.verdict]||"v-maybe";
    const vText={buy:"Варто купити",maybe:"Подумайте",skip:"Краще пропустити"}[r.verdict]||"Подумайте";
    const perCombo=price&&combos?Math.round(price/combos):null;
    st.textContent="";
    $("#buyResult").style.opacity="1";
    $("#buyResult").innerHTML=`
      <div class="verdict ${vClass}">${vText}</div>
      <p style="margin:0 0 10px"><b>${esc(r.name||"Річ")}</b>${price?` — ${price} грн`:""}${price&&avg?` · середня річ у вашому гардеробі ${avg} грн`:""}</p>
      <div class="factgrid">
        <div class="fact"><b>${similar.length}</b><span>схожих речей у вас</span></div>
        <div class="fact"><b>+${combos}</b><span>можливих комбінацій</span></div>
        <div class="fact"><b>${outfits.length}</b><span>нових образів</span></div>
        <div class="fact"><b>${perCombo!=null?perCombo:"—"}</b><span>грн на комбінацію</span></div>
      </div>
      <p style="margin:0 0 12px">${esc(r.reason||"")}</p>
      ${outfits.map(o=>lookHTML(o,{actions:""})).join("")}
      <button class="btn primary block" data-buy-add='${esc(JSON.stringify({name:r.name,category:cat,color:r.color,hex:r.hex,style:r.style,warmth:r.warmth,seasons:r.seasons,price}))}'>Я купив — додати в гардероб</button>`;
    $("#buyGo").textContent="Оцінити ще раз";
  }catch(err){showAIError(err,st)}
  finally{$("#buyGo").disabled=false}
};


/* ---------- Розумна валіза ---------- */
const packDlg=$("#packDlg");
$("#packClose").onclick=()=>packDlg.close();
$("#packGo").onclick=async()=>{
  const st=$("#packStatus");st.classList.remove("err");$("#packResult").innerHTML="";
  const city=$("#packCity").value.trim(),days=Math.max(1,Math.min(14,Number($("#packDays").value)||5));
  if(!city){st.textContent="Впишіть місто призначення.";st.classList.add("err");return}
  if(!getKey()){st.textContent=aiCopy({code:"no_key"});st.classList.add("err");return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Дивлюся прогноз погоди…`;
  let f;
  try{f=await forecast(city,days)}
  catch(e){st.textContent=e.message==="notfound"?"Такого міста не знайшлося.":"Не вдалося отримати прогноз.";st.classList.add("err");return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Пакую валізу…`;
  try{
    const wx=f.days.slice(0,days).map((d,i)=>`День ${i+1} (${d.date}): ${d.min}…${d.max}°C, ${d.weather}`).join("\n");
    const r=await AI.json(Prompts.packing({city:f.city,days,wx,catalog:catalogText(state.items)}),{temperature:0.6});
    const known=new Set(state.items.map(i=>i.id));
    const pack=(Array.isArray(r.pack)?r.pack:[]).map(String).filter(id=>known.has(id));
    const dayList=(Array.isArray(r.days)?r.days:[]).map(d=>({day:d.day,title:String(d.title||""),
      items:(Array.isArray(d.items)?d.items:[]).map(String).filter(id=>known.has(id))}));
    st.textContent="";
    $("#packResult").innerHTML=`
      <div class="factgrid"><div class="fact"><b>${pack.length}</b><span>речей у валізі</span></div><div class="fact"><b>${dayList.length}</b><span>готових образів</span></div></div>
      <p style="margin:0 0 12px">${esc(r.note||"")}</p>
      ${dayList.map((d,i)=>{
        const w=f.days[i];
        return `<div class="packday"><b>День ${d.day||i+1} — ${esc(d.title)}</b><span>${w?`${w.min}…${w.max}°C, ${w.weather.toLowerCase()} · `:""}${d.items.map(id=>esc(itemById(id)?.name||"")).filter(Boolean).join(" + ")}</span></div>`;
      }).join("")}`;
  }catch(e){showAIError(e,st)}
};


/* ---------- Примірка на мені ---------- */
const tryDlg=$("#tryDlg");
$("#tryClose").onclick=()=>tryDlg.close();
async function tryOn(outfit){
  if(!canUse("tryon"))return openPaywall("Примірка образів на вашому фото доступна в Premium.");
  tryDlg.showModal();
  const st=$("#tryStatus");st.classList.remove("err");$("#tryResult").innerHTML="";
  if(!state.userPhoto){st.innerHTML=`Спершу додайте своє фото у вкладці «Профіль».`;st.classList.add("err");return}
  const items=(outfit.items||[]).map(itemById).filter(i=>i&&i.photo);
  if(!items.length){st.textContent="У речей цього образу немає фото. Примірка працює лише зі сфотографованими речами.";st.classList.add("err");return}
  if(!getKey()){st.textContent=aiCopy({code:"no_key"});st.classList.add("err");return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Приміряю образ… Це може зайняти до хвилини.`;
  try{
    const imgs=[dataUrlToB64(state.userPhoto),...items.slice(0,4).map(i=>dataUrlToB64(i.photo))];
    const names=items.slice(0,4).map(i=>i.name).join(", ");
    const url=await AI.image(Prompts.tryOn(names),imgs,null);
    $("#tryResult").innerHTML=`<div class="tryout"><img src="${esc(url)}" alt="Образ на вашому фото"></div><p class="lead">Це приблизна візуалізація від AI, а не точна примірка.</p>`;
    st.textContent="";
  }catch(e){showAIError(e,st)}
}



/* ---------- Що докупити ---------- */
const shopDlg=$("#shopDlg");
$("#shopClose").onclick=()=>shopDlg.close();
function openShop(){
  $("#shopResult").innerHTML="";
  $("#shopStatus").textContent="";$("#shopStatus").classList.remove("err");
  shopDlg.showModal();
}
$("#shopGo").onclick=async()=>{
  const st=$("#shopStatus");st.classList.remove("err");
  if(!getKey()){st.textContent=aiCopy({code:"no_key"});st.classList.add("err");return}
  if(state.items.length<4){st.textContent="Спершу оцифруйте хоча б 4 речі, інакше нема з чим порівнювати.";st.classList.add("err");return}
  const maxPrice=Number($("#shopBudget").value)||0;
  $("#shopGo").disabled=true;
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Шукаю прогалини у вашому гардеробі…`;
  try{
    const r=await AI.json(Prompts.gaps({catalog:catalogText(state.items),maxPrice}),{temperature:0.5});
    const gaps=(Array.isArray(r.gaps)?r.gaps:[]).slice(0,3).map(g=>({
      name:String(g.name||"Річ"),query:String(g.query||g.name||""),
      category:CATS[g.category]?g.category:"top",why:String(g.why||""),
      priceFrom:Number(g.priceFrom)||0,priceTo:Number(g.priceTo)||0
    })).filter(g=>g.query);
    if(!gaps.length){st.textContent="Не вдалося підібрати. Спробуйте ще раз.";st.classList.add("err");return}
    st.textContent="";
    $("#shopResult").innerHTML=
      (r.note?`<p style="margin:0 0 12px">${esc(r.note)}</p>`:"")+
      gaps.map(g=>{
        // кількість нових комбінацій рахує наш код, а не AI
        const combos=newCombos(g.category);
        const price=g.priceFrom&&g.priceTo?`${g.priceFrom}–${g.priceTo} грн`:(g.priceFrom?`від ${g.priceFrom} грн`:"");
        const perCombo=g.priceFrom&&combos?` · близько ${Math.round(g.priceFrom/combos)} грн за комбінацію`:"";
        const over=maxPrice&&g.priceFrom>maxPrice;
        return `<div class="gap">
          <h4>${esc(g.name)}</h4>
          ${price?`<div class="price">${esc(price)}${perCombo}</div>`:""}
          <div class="combos">+${combos} нових комбінацій</div>
          <p>${esc(g.why)}</p>
          ${over?`<p class="price">Дешевше за ${maxPrice} грн таку річ знайти важко — пошук усе одно покаже найдешевші пропозиції.</p>`:""}
          <a class="btn tape block" href="${esc(shopSearchUrl(g.query,null,maxPrice))}" target="_blank" rel="noopener">
            ${maxPrice?`Магазини, де є до ${maxPrice} грн`:"Знайти в магазинах"}</a>
          <div class="shoplabel">або шукати в конкретному магазині:</div>
          <div class="shops">
            ${state.city?`<a class="btn sm" href="${esc(shopSearchUrl(g.query+" "+state.city,null,maxPrice))}" target="_blank" rel="noopener">📍 ${esc(state.city)}</a>`:""}
            ${SHOPS.map(sh=>`<a class="btn sm" href="${esc(shopSearchUrl(g.query,sh.site,maxPrice))}" target="_blank" rel="noopener">${esc(sh.name)}</a>`).join("")}
          </div>
        </div>`;
      }).join("")+
      `<p class="privacy">${maxPrice?`Перша кнопка відкриває пошук по товарах із фільтром «не дорожче ${maxPrice} грн» — там видно саме ті магазини, де річ є за цю ціну, разом з їхніми цінами. `:""}Наявність і ціни показує пошук магазинів; застосунок їх не зберігає. Партнерські відрахування підключаються додаванням коду партнера до цих самих посилань.</p>`;
  }catch(e){showAIError(e,st)}
  finally{$("#shopGo").disabled=false}
};

/* ---------- Premium ---------- */
const payDlg=$("#payDlg");
function openPaywall(reason){
  $("#payReason").textContent=reason||"Більше місця для гардеробу, кілька стилів і функції, які економлять гроші на покупках.";
  $("#payPerks").innerHTML=premiumPerks();
  $("#payPrice").textContent=PLAN.price;
  payDlg.showModal();
}
$("#payClose").onclick=()=>payDlg.close();
$("#payTry").onclick=()=>{
  setPremium(true);payDlg.close();
  toast("Premium увімкнено (демо) ✨");
  if(!obEl.hidden)obRender();   // якщо відкрито з анкети — одразу зняти обмеження стилів
};

/* ---------- Ключ ---------- */
const keyDlg=$("#keyDlg");
async function showModels(){
  const st=$("#keyStatus");if(!st)return;
  st.classList.remove("err");
  if(!getKey()){st.textContent="";return}
  st.innerHTML=`<span class="spinner" aria-hidden="true"></span> Перевіряю, які моделі доступні…`;
  await loadModels(true);
  if(!MODELS.smart){st.textContent="Google не повернув жодної доступної моделі. Перевірте ключ.";st.classList.add("err");return}
  st.textContent=`Моделі: ${MODELS.fast} (швидка), ${MODELS.smart} (основна), `+(MODELS.image?`${MODELS.image} (примірка)`:"примірка недоступна");
}
$("#keyBtn").onclick=()=>{$("#keyIn").value=getKey();$("#keyStatus").textContent="";keyDlg.showModal();showModels()};
$("#keyCancel").onclick=()=>keyDlg.close();
$("#keySave").onclick=async()=>{
  try{localStorage.setItem(KEY_LS,$("#keyIn").value.trim())}catch(e){}
  MODELS.loaded=false;MODELS.fast=MODELS.smart=MODELS.image=null;
  renderAIState();toast(getKey()?"Ключ збережено, перевіряю моделі…":"Ключ порожній");
  if(getKey())await showModels();else keyDlg.close();
};
$("#keyDel").onclick=()=>{try{localStorage.removeItem(KEY_LS)}catch(e){}
  MODELS.loaded=false;MODELS.fast=MODELS.smart=MODELS.image=null;
  $("#keyStatus").textContent="";keyDlg.close();renderAIState();toast("Ключ видалено")};


/* ---------- Обробка кліків ---------- */
document.addEventListener("click",async e=>{
  const t=e.target.closest("button");if(!t)return;
  const d=t.dataset;
  if(d.act==="add")openItem(null);
  else if(d.act==="demo")loadDemo();
  else if(d.act==="buy")openBuy();
  else if(d.act==="shop")openShop();
  else if(d.act==="paywall")openPaywall("");
  else if(d.act==="plan-off"){setPremium(false);toast("Ви на безкоштовному тарифі")}
  else if(d.act==="pack"&&!canUse("pack"))openPaywall("Розумна валіза доступна в Premium.");
  else if(d.act==="pack"){$("#packResult").innerHTML="";$("#packStatus").textContent="";packDlg.showModal()}
  else if(d.act==="profile")analyseStyle();
  else if(d.act==="edit-profile")startOnboarding(true);
  else if(d.act==="avatar-del"){if(state.user){delete state.user.avatar;Store.update();toast("Аватар прибрано")}}
  else if(t.id==="meAvatar")showTab("me");
  else if(d.act==="reset"){
    if(!confirm("Видалити акаунт, гардероб і всі образи? Дію не можна скасувати."))return;
    try{localStorage.removeItem(LS_KEY)}catch(e){}
    location.reload();
  }
  else if(d.item)openItem(d.item);
  else if(d.filter){state.filter=d.filter;renderWardrobe()}
  else if(d.ev){state.event=d.ev;renderChoiceChips()}
  else if(d.wx){state.weather=d.wx;renderChoiceChips()}
  else if(d.goto)showTab(d.goto);
  else if(d.start)startChallenge(d.start);
  else if(d.claim){const ch=CHALLENGES.find(c=>c.id===d.claim);if(ch)claimChallenge(ch)}
  else if(d.revive){showTab("outfit");generate({forceItem:d.revive})}
  else if(t.id==="moreBtn")generate({fresh:true});
  else if(d.save!=null){
    const o=state.results?.outfits[Number(d.save)];if(!o||o.saved)return;
    const r=state.results;
    state.outfits.push({id:newId(),title:o.title,items:o.items,why:o.why,tip:o.tip,event:r.event,temp:r.temp,weather:r.weather,city:r.city,createdAt:Date.now()});
    if(Store.update()){o.saved=true;t.textContent="Збережено ✓";addPoints(10,"Образ збережено.");Store.update()}
  }
  else if(d.wearRes!=null){const o=state.results?.outfits[Number(d.wearRes)];if(o)wear(o.items)}
  else if(d.wearSaved){const o=state.outfits.find(x=>x.id===d.wearSaved);if(o)wear(o.items)}
  else if(d.tryRes!=null){const o=state.results?.outfits[Number(d.tryRes)];if(o)tryOn(o)}
  else if(d.trySaved){const o=state.outfits.find(x=>x.id===d.trySaved);if(o)tryOn(o)}
  else if(d.delOutfit){
    if(!confirm("Видалити цей образ?"))return;
    state.outfits=state.outfits.filter(x=>x.id!==d.delOutfit);Store.update();toast("Образ видалено");
  }
  else if(d.buyAdd){
    let r;try{r=JSON.parse(d.buyAdd)}catch(err){return}
    buyDlg.close();openItem(null);
    fillForm({...r,seasons:Array.isArray(r.seasons)?r.seasons.filter(s=>SEASONS[s]):[]});
    $("#fPrice").value=r.price||"";
  }
});
/* ---------- Аватар ---------- */
document.addEventListener("change",async e=>{
  if(e.target.id!=="avatarIn"&&e.target.id!=="obAvatarIn")return;
  const file=e.target.files?.[0];if(!file)return;
  let img;
  try{img=await loadImage(file)}catch(err){toast("Це фото не вдалося відкрити.");return}
  const fromOnboarding=e.target.id==="obAvatarIn";
  if(fromOnboarding)obCollect();                    // не губимо вже введені поля
  if(!state.user)state.user=blankUser();
  state.user.avatar=toSquare(img,256).toDataURL("image/jpeg",0.85);
  Store.update();
  if(fromOnboarding)obRender();
  toast("Аватар оновлено");
});

document.addEventListener("change",async e=>{
  if(e.target.id!=="meIn")return;
  const file=e.target.files?.[0];if(!file)return;
  try{
    const img=await loadImage(file);
    state.userPhoto=toCanvas(img,700).toDataURL("image/jpeg",0.8);
    Store.update();toast("Фото збережено");
  }catch(err){toast("Це фото не вдалося відкрити.")}
});


/* ---------- Старт ---------- */
Store.load();
renderChoiceChips();
$("#city").value=state.city;
Store.subscribe(renderAll);   // інтерфейс перемальовується сам після кожної зміни стану
renderAll();
renderAIState();
if(getKey())loadModels();
// перший запуск — показуємо реєстрацію та анкету стилю
if(!state.user||!state.user.done)startOnboarding(false);

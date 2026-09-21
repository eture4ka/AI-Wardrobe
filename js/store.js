/* =========================================================
   SmartWardrobe — шар 2: стан і сховище
   Стан застосунку, збереження в localStorage і дії, що змінюють стан.
   Інтерфейс не змінює стан напряму — тільки через Store.update().
   ========================================================= */

/* ---------- Стан застосунку ---------- */
const state={
  items:[],outfits:[],wearLog:[],profile:null,points:0,challenges:{},city:"",userPhoto:null,user:null,premium:false,
  filter:"all",event:"Навчання",weather:"Хмарно",results:null,editing:null,draftPhoto:null,buyBlob:null,ctl:null,
  ai:null,aiBusy:false
};

/* ---------- Порожній профіль користувача ---------- */
const blankUser=()=>({name:"",email:"",phone:"",age:"",gender:"",height:"",sizeTop:"",sizeShoe:"",quiz:{},done:false});
/* ---------- Сховище (localStorage) ---------- */
const listeners=[];

const Store={
  /** Підписка інтерфейсу на зміни стану. */
  subscribe(fn){listeners.push(fn)},
  /** Єдиний дозволений спосіб змінити стан: змінити → зберегти → повідомити інтерфейс. */
  update(mutator){
    if(mutator)mutator(state);
    const ok=Store.save();
    listeners.forEach(fn=>{try{fn(state)}catch(e){console.error("Помилка перемальовування",e)}});
    return ok;
  },
  load(){
    try{
      const d=JSON.parse(localStorage.getItem(LS_KEY)||"{}");
      state.items=Array.isArray(d.items)?d.items:[];
      state.outfits=Array.isArray(d.outfits)?d.outfits:[];
      state.wearLog=Array.isArray(d.wearLog)?d.wearLog:[];
      state.challenges=d.challenges&&typeof d.challenges==="object"?d.challenges:{};
      state.profile=d.profile||null;
      state.points=Number(d.points)||0;
      state.city=d.city||"";
      state.userPhoto=d.userPhoto||null;
      state.user=d.user||null;
      state.premium=!!d.premium;
    }catch(e){console.warn("Не вдалося прочитати сховище",e)}
  },
  save(){
    try{
      localStorage.setItem(LS_KEY,JSON.stringify({items:state.items,outfits:state.outfits,wearLog:state.wearLog,
        challenges:state.challenges,profile:state.profile,points:state.points,city:state.city,userPhoto:state.userPhoto,user:state.user,premium:state.premium}));
      return true;
    }catch(e){toast("Сховище браузера переповнене. Видаліть кілька фото або речей.");return false}
  }
};



function addPoints(n,why){
  state.points+=n;
  if(why)toast(why+" +"+n+" балів");
}
function startChallenge(id){
  const st={startedAt:Date.now()};
  if(id==="revive")st.targets=forgottenItems().slice(0,12).map(i=>i.id);
  state.challenges[id]=st;Store.update();
  toast("Челендж почався. Успіхів!");
}
function claimChallenge(ch){
  const st=state.challenges[ch.id];if(!st||st.claimed)return;
  st.claimed=true;addPoints(ch.points,"Челендж пройдено!");Store.update();
}


/* ---------- Дії над станом ---------- */
function wear(ids){
  const now=Date.now(),d=today();
  ids.forEach(id=>{const it=itemById(id);if(it){it.wearCount=(it.wearCount||0)+1;it.lastWorn=now}});
  state.wearLog.push({d,at:now,items:[...ids]});
  if(state.wearLog.length>400)state.wearLog=state.wearLog.slice(-400);
  const firstToday=state.wearLog.filter(w=>w.d===d).length===1;
  if(firstToday)state.points+=5;
  Store.update();
  toast(firstToday?"Записано. Гарного дня! +5 балів":"Записано");
}



function loadDemo(){
  const now=Date.now();
  DEMO.forEach(([name,category,color,hex,style,seasons,warmth,price,wearCount,lastAgo,boughtAgo])=>{
    state.items.push({id:newId(),name,category,color,hex,style,seasons,warmth,price,photo:null,
      wearCount,lastWorn:lastAgo==null?null:now-lastAgo*DAY,createdAt:now-boughtAgo*DAY});
  });
  Store.update();toast("Приклад гардеробу завантажено");
}


/* ---------- Тариф ---------- */
function setPremium(on){Store.update(st=>{st.premium=!!on})}

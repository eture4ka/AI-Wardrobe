/* =========================================================
   SmartWardrobe — шар 1: конфігурація
   Тільки дані: довідники, налаштування, демо-гардероб.
   Цей файл нічого не викликає і ні від чого не залежить.
   ========================================================= */

/* ---------- Довідники предметної області ---------- */
const CATS={top:{label:"Верх",emoji:"👕"},bottom:{label:"Низ",emoji:"👖"},dress:{label:"Сукні",emoji:"👗"},outer:{label:"Верхній одяг",emoji:"🧥"},shoes:{label:"Взуття",emoji:"👟"},acc:{label:"Аксесуари",emoji:"👜"}};
const STYLES={casual:"Повсякденний",office:"Діловий",sport:"Спортивний",evening:"Вечірній",street:"Стрітстайл"};
const SEASONS={spring:"Весна",summer:"Літо",autumn:"Осінь",winter:"Зима"};
const EVENTS=["Навчання","Робота","Побачення","Вечірка","Прогулянка","Спорт"];
const WEATHER=["Сонячно","Хмарно","Дощ","Сніг","Вітер"];
const LEVELS=[{p:0,name:"Style Beginner"},{p:100,name:"Fashion Explorer"},{p:300,name:"Smart Stylist"},{p:700,name:"Style Master"}];
const FORGOT_DAYS=30;   // не носили стільки днів — річ вважається забутою
const NEW_GRACE_DAYS=14; // новій речі даємо два тижні, перш ніж нагадувати про неї
const LS_KEY="smartwardrobe-v2";
const KEY_LS="smartwardrobe-key";

const CHALLENGES=[
  {id:"no-repeat",title:"7 днів без повторення образу",hint:"Щодня вдягайте новий набір речей",goal:7,points:80},
  {id:"hero",title:"5 образів з однією річчю",hint:"Покажіть, що базова річ працює по-різному",goal:5,points:60},
  {id:"revive",title:"Оживіть 3 забуті речі",hint:"Вдягніть те, що давно лежить без діла",goal:3,points:70},
  {id:"digitize",title:"Оцифруйте 20 речей",hint:"Чим повніший гардероб, тим точніші поради",goal:20,points:50}
];


/* ---------- Анкета стилю та стать ---------- */
const GENDERS=[["female","Жінка","👩"],["male","Чоловік","👨"],["other","Інше / не вказую","🙂"]];
// Кожен варіант: [значення, підпис, емодзі, фон плитки].
// max:"styles" — скільки варіантів можна обрати, залежить від тарифу (див. PLAN).
const QUIZ=[
  {id:"vibe",q:"Які стилі вам до душі?",lead:"Це задасть загальний тон рекомендацій.",multi:true,max:"styles",
   opts:[["min","Мінімалізм","🤍","linear-gradient(135deg,#f5f4f0 0 58%,#d8d3ca 58%)"],
         ["classic","Класика","🧥","linear-gradient(135deg,#2b3040 0 52%,#c8ad7f 52%)"],
         ["street","Стрітстайл","🧢","linear-gradient(135deg,#222 0 45%,#f4c542 45% 58%,#8a8a8a 58%)"],
         ["romantic","Романтичний","🌸","radial-gradient(circle at 30% 35%,#f4b6cc 0 22%,transparent 23%),radial-gradient(circle at 72% 62%,#fbd9e6 0 20%,transparent 21%),#fff3f7"],
         ["sport","Спортивний","👟","linear-gradient(90deg,#f6f6f6 0 30%,#1f5e5b 30% 40%,#f6f6f6 40% 60%,#1f5e5b 60% 70%,#f6f6f6 70%)"],
         ["boho","Бохо","🪶","linear-gradient(135deg,#c98b5b 0 34%,#e9d3b0 34% 66%,#7d8b5a 66%)"]]},
  {id:"colors",q:"Які кольори носите найчастіше?",lead:"Можна обрати кілька.",multi:true,
   opts:[["neutral","Нейтральні","🤍","linear-gradient(90deg,#fff 0 33%,#cfcac1 33% 66%,#e8dccb 66%)"],
         ["dark","Темні","🖤","linear-gradient(90deg,#111 0 33%,#3a3a40 33% 66%,#1c2331 66%)"],
         ["bright","Яскраві","🌈","linear-gradient(90deg,#e63946 0 25%,#ffb703 25% 50%,#2a9d8f 50% 75%,#3a86ff 75%)"],
         ["pastel","Пастельні","🩵","linear-gradient(90deg,#cfe8ff 0 33%,#ffd6e7 33% 66%,#e2f0cb 66%)"],
         ["earth","Земляні","🤎","linear-gradient(90deg,#6b705c 0 33%,#a5a58d 33% 66%,#7f5539 66%)"]]},
  {id:"pattern",q:"Одноколірне чи з візерунком?",lead:"Можна обрати кілька — наприклад, базу й акценти.",multi:true,
   opts:[["solid","Одноколірне","⬜","#8aa1b1"],
         ["stripe","Смужка","〰️","repeating-linear-gradient(90deg,#fff 0 10px,#1c2331 10px 16px)"],
         ["check","Клітинка","🔲","repeating-linear-gradient(0deg,rgba(170,40,40,.55) 0 8px,transparent 8px 16px),repeating-linear-gradient(90deg,rgba(170,40,40,.55) 0 8px,transparent 8px 16px),#f3e9dc"],
         ["floral","Квіти","🌼","radial-gradient(circle,#f28ab2 0 4px,transparent 5px) 0 0/22px 22px,radial-gradient(circle,#9bd18b 0 3px,transparent 4px) 11px 11px/22px 22px,#fff6f0"],
         ["dots","Горошок","⚫","radial-gradient(circle,#1c2331 0 3px,transparent 4px) 0 0/16px 16px,#fff"],
         ["print","Принт і графіка","🐆","radial-gradient(ellipse at 30% 40%,#3b2a1a 0 5px,transparent 6px) 0 0/24px 18px,#d9a55b"]]},
  {id:"comfort",q:"Комфорт чи вигляд?",lead:"Чесна відповідь зробить поради реалістичними.",multi:false,
   opts:[["comfort","Комфорт понад усе","🛋️","#dfe9e4"],["balance","Шукаю баланс","⚖️","#ece6d8"],["look","Вигляд важливіший","✨","#efe0ea"]]},
  {id:"experiment",q:"Любите експерименти в одязі?",lead:"Від цього залежить, наскільки сміливі будуть образи.",multi:false,
   opts:[["no","Ні, тримаюся базового","🧱","#e4e2de"],["some","Іноді","🙂","#e8eddb"],["yes","Так, люблю сміливі рішення","🎨","#f3dfd2"]]},
  {id:"pain",q:"Що вас найбільше дратує?",lead:"Можна обрати кілька — застосунок на цьому сфокусується.",multi:true,
   opts:[["nothing","«Повна шафа, а вдягнути нічого»","😩","#e9e4f1"],["waste","Купую зайве","🛍️","#f1e6dc"],["time","Довго збираюся вранці","⏰","#dfe8f0"],["match","Не знаю, що з чим поєднується","🤔","#e7eee2"]]}
];
const QUIZ_LABEL={};QUIZ.forEach(q=>q.opts.forEach(([v,l])=>QUIZ_LABEL[q.id+":"+v]=l));

/* ---------- Налаштування моделей AI ---------- */
// Застосунок сам питає у Google список доступних моделей і бере першу з цього списку переваг.
// Якщо хочете конкретну модель — поставте її назву першою.
const MODEL_PREFS={
  fast:["gemini-3.5-flash-lite","gemini-3.6-flash-lite","gemini-3.1-flash-lite","gemini-3.6-flash","gemini-3.5-flash"],
  smart:["gemini-3.6-flash","gemini-3.5-flash","gemini-3.7-flash","gemini-3.8-flash","gemini-3.5-flash-lite"],
  image:["gemini-3.1-flash-image","gemini-3-pro-image","gemini-3.1-flash-lite-image","gemini-2.5-flash-image"]
};
const MODELS={fast:null,smart:null,image:null,list:[],loaded:false};
const BAD_MODEL=/live|tts|transcribe|embedding|embed|aqa|veo|imagen|learnlm|gemma|audio/i;

/* ---------- Демонстраційний гардероб ---------- */
// назва, категорія, колір, hex, стиль, сезони, теплота, ціна, скільки разів вдягали, днів тому востаннє (null = жодного разу), днів тому куплено
const DEMO=[
  ["біла футболка","top","білий","#F2F2EF","casual",["spring","summer"],1,450,12,3,120],
  ["блакитна сорочка","top","блакитний","#9CC3E4","office",["spring","summer","autumn"],2,1200,6,10,150],
  ["сірий светр","top","сірий","#9A9A9E","casual",["autumn","winter"],4,1400,4,40,300],
  ["чорний худі","top","чорний","#2B2830","street",["autumn","winter"],3,1600,9,5,200],
  ["джинси прямого крою","bottom","синій","#3B5B8C","casual",["spring","autumn","winter"],2,1800,20,2,240],
  ["чорні брюки","bottom","чорний","#26232B","office",["spring","autumn","winter"],2,1500,7,12,180],
  ["спідниця міді","bottom","бежевий","#D8C3A5","casual",["spring","summer","autumn"],1,900,1,70,160],
  ["чорна сукня","dress","чорний","#1E1B22","evening",["spring","summer","autumn"],2,2200,2,90,400],
  ["тренч","outer","пісочний","#C8AD7F","office",["spring","autumn"],3,3500,5,25,330],
  ["пуховик","outer","оливковий","#5E6B3D","casual",["winter"],5,4800,0,null,60],
  ["білі кросівки","shoes","білий","#EDEDEA","casual",["spring","summer","autumn"],1,2400,18,2,210],
  ["чорні лофери","shoes","чорний","#2A262E","office",["spring","autumn"],1,2100,3,45,280],
  ["шкіряна сумка","acc","коричневий","#7A4A2A","casual",["spring","summer","autumn","winter"],1,1900,0,null,45]
];
const DAY=86400000;

/* ---------- Магазини для пошуку ---------- */
// Посилання ведуть у пошук магазину. У реальному продукті тут будуть
// партнерські (афіліатні) посилання — та сама адреса плюс код партнера.
const SHOPS=[
  {name:"Rozetka",   site:"rozetka.com.ua"},
  {name:"Kasta",     site:"kasta.ua"},
  {name:"Answear",   site:"answear.ua"},
  {name:"INTERTOP",  site:"intertop.ua"},
  // майданчики українських дизайнерів і локальних марок
  {name:"Всі. Свої", site:"vsisvoi.ua"},
  {name:"LOVE&LIVE", site:"loveandlive.ua"}
];

/* ---------- Тарифи ---------- */
// Оплата в прототипі не підключена: Premium вмикається демо-кнопкою.
const PLAN={
  price:149,            // грн на місяць
  freeItems:30,         // скільки речей можна зберегти безкоштовно
  freeStyles:1,         // скільки стилів можна обрати в анкеті безкоштовно
  premiumStyles:3,
  // функції лише для Premium. «Що докупити» навмисно безкоштовне:
  // на ньому застосунок заробляє комісію з покупок.
  premiumOnly:{buy:"«Купувати чи ні?» з фото з магазину",tryon:"Примірка образів на вашому фото",pack:"Розумна валіза для поїздок"}
};

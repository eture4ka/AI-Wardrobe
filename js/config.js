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
const QUIZ=[
  {id:"vibe",q:"Який образ вам ближчий?",lead:"Це задасть загальний тон рекомендацій.",multi:false,
   opts:[["min","Мінімалізм","🤍"],["classic","Класика","🧥"],["street","Стрітстайл","🧢"],["romantic","Романтичний","🌸"],["sport","Спортивний","👟"]]},
  {id:"colors",q:"Які кольори носите найчастіше?",lead:"Можна обрати кілька.",multi:true,
   opts:[["neutral","Нейтральні: білий, сірий, бежевий","🤍"],["dark","Темні: чорний, графіт","🖤"],["bright","Яскраві акценти","🌈"],["pastel","Пастельні","🩵"],["earth","Земляні: хакі, коричневий","🤎"]]},
  {id:"comfort",q:"Комфорт чи вигляд?",lead:"Чесна відповідь зробить поради реалістичними.",multi:false,
   opts:[["comfort","Комфорт понад усе","🛋️"],["balance","Шукаю баланс","⚖️"],["look","Вигляд важливіший","✨"]]},
  {id:"experiment",q:"Любите експерименти в одязі?",lead:"Від цього залежить, наскільки сміливі будуть образи.",multi:false,
   opts:[["no","Ні, тримаюся базового","🧱"],["some","Іноді","🙂"],["yes","Так, люблю сміливі рішення","🎨"]]},
  {id:"pain",q:"Що вас найбільше дратує?",lead:"Можна обрати кілька — застосунок на цьому сфокусується.",multi:true,
   opts:[["nothing","«Повна шафа, а вдягнути нічого»","😩"],["waste","Купую зайве","🛍️"],["time","Довго збираюся вранці","⏰"],["match","Не знаю, що з чим поєднується","🤔"]]}
];
const QUIZ_LABEL={};QUIZ.forEach(q=>q.opts.forEach(([v,l])=>QUIZ_LABEL[q.id+":"+v]=l));

/* ---------- Налаштування моделей AI ---------- */
// Застосунок сам питає у Google список доступних моделей і бере першу з цього списку переваг.
// Якщо хочете конкретну модель — поставте її назву першою.
const MODEL_PREFS={
  fast:["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-2.5-flash-lite","gemini-3.5-flash","gemini-2.5-flash"],
  smart:["gemini-3.5-flash","gemini-3.7-flash","gemini-3.8-flash","gemini-2.5-flash","gemini-2.5-pro","gemini-3.5-flash-lite"],
  image:["gemini-3.1-flash-image","gemini-2.5-flash-image","gemini-3-pro-image","gemini-3.1-flash-lite-image"]
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

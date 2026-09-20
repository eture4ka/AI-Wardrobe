/* =========================================================
   SmartWardrobe — шар 4: зовнішній сервіс — Open-Meteo
   Погода і прогноз. Безкоштовно, без ключа.
   ========================================================= */


function wxFromCode(code,wind){
  if(code>=71&&code<=77||code===85||code===86)return "Сніг";
  if(code>=51&&code<=67||code>=80&&code<=82||code>=95)return "Дощ";
  if(wind>=25)return "Вітер";
  if(code<=1)return "Сонячно";
  return "Хмарно";
}
async function geocode(name){
  const r=await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=uk&format=json&name="+encodeURIComponent(name));
  if(!r.ok)throw new Error("geo");
  const d=await r.json();
  if(!d.results?.length)throw new Error("notfound");
  return d.results[0];
}
async function currentWeather(name){
  const g=await geocode(name);
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code,wind_speed_10m`);
  if(!r.ok)throw new Error("wx");
  const c=(await r.json()).current;
  return {city:g.name,temp:Math.round(c.temperature_2m),weather:wxFromCode(c.weather_code,c.wind_speed_10m)};
}
async function forecast(name,days){
  const g=await geocode(name);
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=${Math.min(16,days)}&timezone=auto`);
  if(!r.ok)throw new Error("wx");
  const d=(await r.json()).daily;
  return {city:g.name,days:d.time.map((t,i)=>({date:t,max:Math.round(d.temperature_2m_max[i]),min:Math.round(d.temperature_2m_min[i]),weather:wxFromCode(d.weather_code[i],0)}))};
}


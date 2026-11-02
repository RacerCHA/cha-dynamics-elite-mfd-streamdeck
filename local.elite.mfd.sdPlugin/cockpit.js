'use strict';

// Each SVG uses the physical classic Stream Deck key's 72 × 72 coordinate system.
const C = { ink:'#DBE5F1', white:'#f3fbff', cyan:'#34CBFD', mid:'#32BEFF',
  dim:'#9dbddb', dark:'#0a2036', soft:'#103954', button:'#11547a', line:'#0096D2' };
const glyphs = {
 camera:'M3 10H9L12 6H20L23 10H29V26H3ZM11 18A5 5 0 1 0 21 18A5 5 0 1 0 11 18',
 nav:'M3 24L16 2 29 24 16 18Z',
 systems:'M8 4V12M8 20V28M23 4V17M23 25V28M3 16H13M18 21H28',
 back:'M14 6L4 16 14 26M5 16H22Q28 16 28 10V6',
 exit:'M14 3H4V29H14M13 16H30M23 8L31 16 23 24',
 hud:'M2 22L7 7H25L30 22ZM9 16H13M19 16H23',
 hardpoints:'M3 6H12V16L8 25 5 16ZM20 6H29L27 16 24 25 20 16Z',
 system:'M2 18C2 10 20 2 27 7S23 24 10 26 0 21 2 18ZM14 15A3 3 0 1 0 20 15A3 3 0 1 0 14 15',
 galaxy:'M3 23L10 7 20 17 29 4M3 23L23 26 20 17M9 7H11M2 23H4M22 26H24M28 4H30',
 orbit:'M4 23C3 18 11 10 20 7S30 8 28 12 18 24 10 26 4 24 4 23ZM15 15L17 17',
 target:'M3 24L12 12 19 16 29 4M20 4H29V13',
 lamp:'M3 10Q15 3 19 10V22Q15 29 3 22ZM23 9L29 6M24 16H31M23 23L29 26',
 scoop:'M3 19L8 28H24L29 19M16 3V20M10 14L16 20 22 14',
 scanner:'M2 17H8L11 10 15 25 19 3 22 20 25 14H30',
 station:'M4 12L12 4H22L29 12V22L22 29H12L4 22ZM12 13H21V21H12Z',
 credits:'M6 7H24M4 14H19M6 21H21M10 3L6 26Q12 30 24 25',
 fuel:'M4 28V5H19V28ZM7 9H16V16H7ZM20 12Q25 12 25 19V23Q26 28 29 24V10L24 5',
 heat:'M4 26H28M7 21Q12 16 8 12T10 3M15 21Q20 16 16 12T18 3M23 21Q28 16 24 12T26 3',
 shield:'M3 6L16 2 29 6V15Q28 24 16 30Q4 24 3 15Z',
 hull:'M3 25L16 3 29 25 20 22 16 27 12 22Z',
 threat:'M16 3L30 28H2ZM16 10V18M16 22V23',
 fsd:'M2 9L10 16 2 23M12 5L24 16 12 27M22 6L31 16 22 26',
 ship:'M4 25L16 4 28 25 16 18Z', crosshair:'M3 12V5H10M22 5H29V12M29 21V28H22M10 28H3V21M12 16H20M16 12V20',
 legal:'M16 3V28M5 8H27M7 10L3 20H11ZM25 10L21 20H29ZM9 28H23',
 link:'M4 13Q16 2 28 13M8 18Q16 11 24 18M13 23Q16 20 19 23',
};
const menus = {
 nav:[
  ['GalaxyMapOpen','galaxy','Карта','галактики'],['SystemMapOpen','system','Карта','системы'],
  ['OrbitLinesToggle','orbit','Линии','орбит'],['TargetNextRouteSystem','target','Следующая','система'],
  ['PhotoCameraToggle','camera','Внешняя','камера'],
 ],
 systems:[
  ['ShipSpotLightToggle','lamp','Фары'],['ToggleCargoScoop','scoop','Грузовой','ковш'],
  ['PlayerHUDModeToggle','hud','Сменить','HUD'],['ExplorationFSSEnter','scanner','Сканер','FSS'],
 ],
};
function criticalHeat(s){return s?.online && s.statusValid && (s.flags & (1<<24)) && ['damage','overheat'].includes(s.heat);}
function command(menu,i,context,snapshot) {
 if(menu==='nav' && i===4 && !(snapshot?.online && snapshot.statusValid && (snapshot.flags & (1<<24)) && snapshot.hud))return null;
 if(!menu && criticalHeat(snapshot) && ({home:9,fight:8,fuel:5})[context]===i)return 'DeployHeatSink';
 if(i===13 && snapshot?.online && snapshot.statusValid && (snapshot.flags & (1 << 24)) &&
    ['in','out'].includes(snapshot.hardpoints)) return 'DeployHardpointToggle';
 if(!menu && context==='fight' && i===0)return 'CycleNextTarget';
 if(i===10)return '@nav';
 if(i===11)return '@systems';
 if(i===14)return '@exit';
 if(!menus[menu])return null;
 if(i===9)return '@back';
 return menus[menu][i]?.[0]||null;
}
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,fill)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>';
const bg=(color=C.dark)=>rect(0,0,72,72,color);
function text(value,y,size,color=C.white,x=36,anchor='middle'){
 const content=String(value);
 const units=[...content].reduce((total,ch)=>total+(/[МШЩЖЮФMW@]/iu.test(ch)?.96:/[ил1.iI :]/u.test(ch)?.4:.67),0);
 const px=Math.min(size,(anchor==='middle'?62:67-x)/Math.max(units,.1));
 return '<text x="'+x+'" y="'+y+'" fill="'+color+'" font-size="'+px.toFixed(2)+'" font-family="Segoe UI,Arial,sans-serif" font-weight="700" text-anchor="'+anchor+'">'+xml(content)+'</text>';
}
function glyph(id,x,y,size,color=C.cyan){
 return '<g transform="translate('+x+' '+y+') scale('+(size/32)+')" fill="none" stroke="'+color+'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="'+glyphs[id]+'"/></g>';
}
function labelCard(id,top,bottom,selected=false){
 const n=bottom?32:37;
 let out=bg(selected?'#1774a0':C.button)+glyph(id,(72-n)/2,6,n,C.white);
 return out+text(top,bottom?51:62,15)+ (bottom?text(bottom,66,14,C.white):'');
}
function instrument(id,title,value,unit='',alert=false){
 const base=alert?'#155473':C.dark;
 return bg(base)+glyph(id,4,5,13,alert?C.white:C.cyan)+text(title,15,10.6,C.dim,20,'start')
   +text(value,unit?46:52,26,alert?C.white:C.cyan)+(unit?text(unit,65,10.5,C.ink):'');
}
function bigLabel(id,title,sub=''){
 return bg(C.soft)+glyph(id,18,6,36)+text(title,sub?54:63,14)+(sub?text(sub,67,10.5,C.dim):'');
}
// Keep names exact. Wrap first at word boundaries; a long single token spans multiple lines.
function nameChunks(value,count) {
 const all=String(value).trim().split(/\s+/u);
 const limit=Math.max(8,Math.ceil(String(value).length/(count*2)));
 const lines=[];
 for(const word of all){
  let remaining=word;
  if(lines.length && (lines.at(-1)+' '+remaining).length<=limit){lines[lines.length-1]+=' '+remaining;continue;}
  const tokenLimit=Math.max(limit,12);
  while(remaining.length>tokenLimit){lines.push(remaining.slice(0,tokenLimit));remaining=remaining.slice(tokenLimit);}
  if(remaining)lines.push(remaining);
 }
 const per=Math.max(1,Math.ceil(lines.length/count));
 return Array.from({length:count},(_,i)=>lines.slice(i*per,(i+1)*per));
}
function namePanel(id,title,value,index,count,missing='НЕТ ДАННЫХ'){
 if(index===0)return bigLabel(id,title);
 const chunks=nameChunks(value||missing,count-1)[index-1];
 const pitch=Math.min(20,58/Math.max(chunks.length,1));
 return bg(C.soft)+chunks.map((s,i)=>text(s,40+(i-(chunks.length-1)/2)*pitch,chunks.length>1?18:24,value?C.white:C.dim)).join('');
}
function hud(s){
 const mode={analysis:'АНАЛИЗ',fight:'БОЙ'}[s.hud];
 return instrument('hud','HUD',mode||'—',mode?'':(s.online?'Нет данных':'Офлайн'));
}
function hardpoints(s){
 const state={out:'ВЫПУЩ.',in:'УБРАНЫ',cruise:'КРУИЗ',landed:'НА ЗЕМЛЕ',docked:'В ДОКЕ'}[s.hardpoints];
 if(s.context==='fight' && s.hud==='fight' && ['out','in'].includes(s.hardpoints))
  return signal('hardpoints','Подвесы',state,'',s.hardpoints==='out'?tone.green:tone.down);
 return instrument('hardpoints','Подвесы',state||'—',state?'':(s.online?'Нет данных':'Офлайн'));
}
const heatNames={normal:'НОРМА',warning:'НАГРЕВ',overheat:'ПЕРЕГРЕВ',damage:'ТЕРМОУРОН'};
function formatTons(n){return Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:1})+' т':'—';}
function credits(value){
 if(!Number.isFinite(value))return '—';
 const amount=Math.trunc(value);
 if(Math.abs(amount)<1000)return String(amount);
 const units=['','к','кк','ккк'];
 let unit=Math.min(3,Math.floor(Math.log10(Math.abs(amount))/3));
 let scaled=Math.round(Math.abs(amount)/1000**unit*10)/10;
 if(scaled>=1000 && unit<3){unit++;scaled=1;}
 return (amount<0?'-':'')+String(scaled).replace('.',',')+' '+units[unit];
}
function fuelLevel(s){
 if(!s.online || !s.statusValid || !Number.isFinite(s.fuel) || s.fuel<0 ||
    !Number.isFinite(s.capacity) || s.capacity<=0)return null;
 const ratio=s.fuel/s.capacity;
 // Treat a one-ULP difference at the decimal thresholds as equality.
 if(ratio<0.15-Number.EPSILON)return 'critical';
 return ratio<0.5-Number.EPSILON?'low':'normal';
}
function tank(s,now){
 const level=fuelLevel(s), amount=formatTons(s.fuel), total=s.capacity>0?'из '+formatTons(s.capacity):'';
 if(level==='critical'||level==='low')return signal('fuel','Топливо',amount,total,level==='critical'?blink(now):tone.yellow);
 return instrument('fuel','Топливо',amount,total);
}
function home(s,i,now){
 if(i<3)return namePanel('system','Система',s.system,i,3,s.online?'Неизвестна':'Офлайн');
 if(i===3)return bigLabel('credits','Баланс','кредиты');
 if(i===4)return bg(C.soft)+text(credits(s.credits),45,25);
 if(i<8)return namePanel(s.station?'station':'ship',s.station||!s.online||!s.statusValid?'Станция':'Полёт',s.station||(s.online&&s.statusValid?(s.supercruise?'Суперкруиз':s.hardpoints==='landed'?'На поверхности':s.hardpoints==='docked'?'В доке':'В полёте'):null),i-5,3,'Нет данных');
 if(i===8)return tank(s,now);
 return heatBadge(s,now);
}
const tone = {green:'#137442',yellow:'#886900',orange:'#ac4d0b',red:'#af2839',down:'#732636',muted:'#294154'};
function blink(now){return Math.floor(now/550)%2===0?'#d02b3e':'#691729';}
function signal(icon,title,value,detail,color){
 return bg(color)+glyph(icon,4,4,14,C.white)+text(title,15,10.5,C.white,20,'start')+
  text(value,detail?44:50,23,C.white)+(detail?text(detail,65,10.5,C.white):'');
}
function percentGauge(icon,title,n,detail,now,shield=false){
 if(!Number.isFinite(n))return signal(icon,title,'—','Нет данных',tone.muted);
 const color=n===0&&shield?blink(now):n<25?tone.red:n<50?tone.orange:n<75?tone.yellow:tone.green;
 const value=(n>0&&n<1?'<1':Math.floor(n))+'%';
 return signal(icon,title,value,detail,color)+rect(6,66,.60*n,2,C.white);
}
function attackBadge(s,now){
 return bg(s.underAttack?blink(now):C.soft)+glyph('threat',18,5,36,s.underAttack?C.white:C.cyan)
  +text(s.underAttack?'ПОД ОГНЁМ':'СПОКОЙНО',60,13);
}
function ownShield(s,now){
 return signal('shield','Свой щит',s.shields===true?'В СЕТИ':s.shields===false?'СБИТ':'—','',
 s.shields===true?tone.green:s.shields===false?blink(now):tone.muted);
}
function heatBadge(s,now){
 if(criticalHeat(s))return signal('heat','Нагрев',heatNames[s.heat],'Теплоотвод ›',blink(now));
 if(s.heat&&s.heat!=='normal')return signal('heat','Нагрев',heatNames[s.heat],'',s.heat==='warning'?tone.yellow:s.heat==='overheat'?tone.orange:tone.red);
 return instrument('heat','Нагрев',heatNames[s.heat]||'—');
}
function relation(s){
 const legal={Wanted:'Розыск',Clean:'Чист',Lawless:'Без закона',Enemy:'Статус Enemy',Warrant:'Ордер',Hostile:'По закону'};
 return signal('legal','Отношение',s.targetRelation==='wing'?'КРЫЛО':s.targetRelation==='interdictor'?'ПЕРЕХВАТ':'НЕИЗВ.',
 legal[s.targetLegal]||s.targetLegal||'Нет статуса',s.targetRelation==='wing'?tone.green:s.targetRelation==='interdictor'?tone.red:tone.muted);
}
function fight(s,i,now){
 if(i===0)return bigLabel('crosshair','ЦЕЛЬ','Следующая ›');
 if(i===5)return bigLabel('ship','Я','Мой корабль');
 if(i===6)return ownShield(s,now);
 if(i===7)return percentGauge('hull','Свой корпус',s.hull,'Посл. отчёт',now);
 if(i===8)return heatBadge(s,now);
 if(i===9)return attackBadge(s,now);
 if(!s.target){
  if(i===4)return bigLabel('shield','Защита');
  const label=s.underAttack?['ПОД','ОГНЁМ','!']:['НЕТ','ЗАХВАТА',''];
  return bg(s.underAttack?blink(now):C.soft)+text(label[i-1],45,22);
 }
 if(i===1)return percentGauge('shield','Щит цели',s.targetShield,'По скану',now,true);
 if(i===2)return percentGauge('hull','Корпус цели',s.targetHull,'По скану',now);
 if(i===3){const chars=Array.from(s.target);const lines=[];for(let n=0;n<chars.length;n+=13)lines.push(chars.slice(n,n+13).join(''));
  const pitch=Math.min(18,49/lines.length);return bg(C.soft)+text('Цель',13,10,C.dim)+lines.map((line,n)=>text(line,40+(n-(lines.length-1)/2)*pitch,15)).join('');}
 return relation(s);
}
function perimeter(position,count){
 const first=position===0,last=position===count-1;
 const d='M'+(first?8:0)+' 2H'+(last?64:72)+(last?'Q70 2 70 8V64Q70 70 64 70':'')+
  'M'+(last?64:72)+' 70H'+(first?8:0)+(first?'Q2 70 2 64V8Q2 2 8 2':'');
 return '<path d="'+d+'" fill="none" stroke="#68BDDD" stroke-width="2.8"/>';
}
function group(s,i){
 if(s.context==='home')return i<=2?[i,3]:i<=4?[i-3,2]:i<=7?[i-5,3]:null;
 if(s.context==='nav')return i<3?[i,3]:i>=5?[i-5,5]:null;
 if(s.context==='fuel')return [i%5,5];
 if(s.context==='fight'&&!s.target&&i>=1&&i<=3)return [i-1,3];
 return null;
}
function jump(s,i,now){
 if(i>=5){
  const arrived=s.phase==='arrived'&&s.system;
  return namePanel('target',arrived?'Прибытие':s.jumpTarget?'Цель FSD':'Маршрут',arrived||s.jumpTarget||s.next,i-5,5,'Цель неизвестна');
 }
 if(i<3){
  const active=s.phase==='charging'||s.phase==='jumping';
  const labels=s.phase==='charging'?['FSD','ЗАРЯДКА','ИДЁТ']:s.phase==='jumping'?(s.jumpType==='Supercruise'?['FSD','ВХОД','В КРУИЗ']:s.jumpType==='Hyperspace'?['FSD','ГИПЕР','ПРЫЖОК']:['FSD','ПЕРЕХОД','ИДЁТ']):s.phase==='arrived'?['FSD','ПРИБЫЛИ',''] : ['FSD','ГОТОВ',''];
  let out=bg(C.soft)+ (i===0?glyph('fsd',18,7,36):glyph('fsd',23,9,26,C.mid))+text(labels[i],53,i===0?19:16);
  for(let n=0;n<6;n++){const phase=(i*6+n-Math.floor(now/170)%18+18)%18;out+=rect(n*12,61,10,7,active&&phase<4?C.white:C.line);}
  return out;
 }
 if(i===3)return instrument('target','Пройдено',s.phase==='arrived'&&Number.isFinite(s.jumpDistance)?s.jumpDistance.toLocaleString('ru-RU',{maximumFractionDigits:1}):'—','св. лет');
 return instrument('nav','Маршрут',Number.isFinite(s.remaining)?s.remaining:'—','прыжков');
}
function fuel(s,i,now){
 const col=i%5;
 if(i<5){
  const level=fuelLevel(s);
  const known=level!==null;
  const base=level==='critical'?blink(now):level==='low'?tone.yellow:C.dark;
  const bar=level==='critical'?'#FF8590':level==='low'?'#FFDB65':C.cyan;
  const ratio=known?Math.max(0,Math.min(1,s.fuel/s.capacity)):0;
  const values=['ТОПЛИВО',formatTons(s.fuel),'ИЗ',formatTons(s.capacity),known?Math.round(ratio*100)+'%':'—'];
  const width=Math.max(0,Math.min(72,(ratio*5-col)*72));
  return bg(base)+text(values[col],23,col===1||col===3||col===4?20:14)+rect(0,32,72,22,'#1c4663')+rect(0,32,width,22,bar)+text(col===2?(known?'ОСНОВНОЙ БАК':'НЕТ ДАННЫХ'):'',67,10,C.dim);
 }
 const level=['normal','warning','overheat','damage'].indexOf(s.heat);
 const labels=['НАГРЕВ','НОРМА','НАГРЕВ','ПЕРЕГРЕВ','УРОН'];
 if(col===0&&criticalHeat(s))return heatBadge(s,now);
 if(col===0)return bg(C.soft)+glyph('heat',20,5,32)+text('НАГРЕВ',52,14)+text(level<0?'НЕТ ДАННЫХ':'СТУПЕНИ',66,10,C.dim);
 const active=col===level+1;
 const fill=active?(level>0&&Math.floor(now/540)%2?'#277ca3':'#18658c'):C.dark;
 return bg(fill)+text(labels[col],23,14,active?C.white:C.dim)+rect(0,32,72,22,level>=0&&col<=level+1?(active?C.cyan:'#347a9b'):'#203e54')
  +(active?text('СЕЙЧАС',67,12,C.white):'');
}
function systemsKey(s,i){
 const fields=[
  ['lamp','Фары',s.lights,'ВКЛ','ВЫКЛ'],
  ['scoop','Ковш',s.scoopOpen,'ОТКРЫТ','ЗАКРЫТ'],
  ['hud','Режим HUD',s.hud===null||!s.hud?null:s.hud==='analysis','АНАЛИЗ','БОЙ'],
  ['scanner','Сканер FSS',s.fss,'ОТКРЫТ','ОТКРЫТЬ']
 ];
 const [icon,title,active,yes,no]=fields[i];
 const known=typeof active==='boolean';
 const color=active?'#DAFBFF':known?'#91B3C9':'#71889C';
 const lamp=icon==='lamp'&&active?'<g transform="translate(20 5)"><path d="M3 10Q15 3 19 10V22Q15 29 3 22Z" fill="#D5FFFF"/><circle cx="12" cy="16" r="15" fill="#8BEDFF" opacity=".2"/></g>':'';
 return bg(active?'#11618A':C.dark)+lamp+glyph(icon,20,5,32,color)+text(title,47,13,C.ink)
  +text(known?(active?yes:no):s.online?'НЕТ ДАННЫХ':'ОФЛАЙН',63,15,color);
}
function render(snapshot,menu,i,now=Date.now()){
 const s=snapshot;let svg;
 if(i>=10){
  svg=[()=>labelCard('nav','Навигация','',menu==='nav'),()=>labelCard('systems','Системы','корабля',menu==='systems'),()=>hud(s),()=>hardpoints(s),()=>labelCard('exit','Выход')][i-10]();
 } else if(menus[menu]){
  const button=menus[menu][i];
  if(menu==='systems'&&i<4)svg=systemsKey(s,i);
  else if(button)svg=labelCard(button[1],button[2],button[3]);
  else if(i===9)svg=labelCard('back','Назад');
  else svg=bg('#091a29');
 } else {
  const view={home,fight,nav:jump,fuel}[s.context]||home;
  svg=view(s,i,now);

 }
 const segment=i<10&&!menu?group(s,i):null;
 if(segment || i>=10 || !menu || i===9 || menus[menu]?.[i])svg+=perimeter(...(segment||[0,1]));
 return 'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">'+svg+'</svg>').toString('base64');
}
module.exports={render,command,credits};

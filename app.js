import {Ritual,Microphone,TIMES} from './ritual-core.js?v=4cd79d2a2114';
import {WhiteGift} from './white-gift.js?v=e61b33cb7d91';
import {TicketInput} from './ticket-interaction.js?v=35c7d7a15a5c';
import {MemoryCorridor} from './corridor.js?v=b7b6e7278a27';
import {loadMemoryCatalog} from './memory-data.js?v=34346995ff68';
import {attachBackgroundMusic} from './background-music.js?v=635e79c14c82';
import {SnowflakeMemory} from './snowflake-memory.js?v=27424ee54fac';
const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const snowflakeMemory=new SnowflakeMemory($('#flower-memory'));
window.snowflakeMemory=snowflakeMemory;
// Local design review deliberately keeps the rejected pigment out of the preview.
const designPreview=new URLSearchParams(location.search).get('preview')==='design';
$('#invitation-home').href=designPreview?'?preview=design':'./';
const scenes={letter:$('#letter-scene'),arrival:$('#arrival-scene'),corridor:$('#corridor-scene'),party:$('#party-scene'),candle:$('#candle-scene'),blessing:$('#blessing-scene'),model:$('#model-scene')};
const modelStates=new Set(['loading','exhibit']);
let figurine,corridor,corridorStep=0,loadError=null,toastTimer,animationFrame,last=performance.now(),stopped=false,openingPresented=false,openingPaperScale=1,tearStart=0;
let catalog,catalogPromise,currentMemory;const memoryStates=new Map();
let openingAnimations=[],openingPresentation,portalReveal=0,exhibitSession=false;
let keyboardNavigation=false;
document.addEventListener('keydown',()=>{keyboardNavigation=true;},{capture:true});
document.addEventListener('pointerdown',()=>{keyboardNavigation=false;},{capture:true});
const OPENING_HANDOFF=1850;
const music=attachBackgroundMusic($('#music-toggle'));
for(let i=0;i<33;i++){const s=document.createElement('i');s.className='star'+(i%9===0?' cross':'');Object.assign(s.style,{left:(i*37.731)%100+'%',top:(i*23.17)%94+'%',width:i%3+1+'px',height:i%3+1+'px',animationDelay:-i*.39+'s',animationDuration:6+i%8+'s'});if(i%9===0)s.textContent='✧';$('#stars').append(s);}
for(let i=0;i<10;i++){const d=document.createElement('i');d.className='wish-dot';const a=(i*24+162)*Math.PI/180;d.style.left=50+43*Math.cos(a)+'%';d.style.top=49+46*Math.sin(a)+'%';$('#wish-dots').append(d);}
const mic=new Microphone({onChange(status){if(ritual.state!=='wishing')return;$('#wish-hint').textContent=status==='available'?'闭上眼睛许下愿望\n10 秒后睁开眼轻轻吹灭蜡烛':'闭上眼睛许下愿望\n10 秒后烛光会轻轻熄灭';}});
const ritual=new Ritual({microphone:mic,reduced:reduced.matches,party:true,onState:renderState,onFrame:renderFrame});
const ticket=new TicketInput($('#letter'),$('#accept-letter'),{canInteract:()=>ritual.state==='card'&&!ritual.paused,onTear:()=>ritual.accept()});
document.body.classList.toggle('save-data',!!navigator.connection?.saveData);
for(let i=0;i<14;i++){const m=document.createElement('i'),a=(i/14*Math.PI*2);m.className='birthday-mote'+(i===3?' glint':'');m.style.cssText=`left:${50+39*Math.cos(a)}%;top:${50+37*Math.sin(a)}%;--mote-delay:${-i*1.31}s;--mote-time:${16+i%5*3}s;`;$('#birthday-motes').append(m);}
for(let i=0;i<8;i++){const f=document.createElement('i');f.style.cssText=`--fleck-x:${(i%2?1:-1)*(13+i*8)}px;--fleck-y:${-14-i*8}px;--fleck-angle:${i*37-90}deg;top:${15+i*8}%;`;$('.ticket-flecks').append(f);}
for(let i=0;i<16;i++){const m=document.createElement('i');m.className='party-mote'+(i===2?' glint':'');m.style.cssText=`--x:${i%2?83+(i*7)%13:6+(i*7)%13}%;--y:${14+(i*17)%65}%;--delay:${-i*1.17}s;--angle:${i*31}deg`;$('#party-motes').append(m);}
function renderState(state){
 music.setStage(state);
 if(!['exhibit','loading'].includes(state)){exhibitSession=false;figurine?.leave();if($('#gift-dialog').open)$('#gift-dialog').close();}
 if(state==='loading'&&$('#gift-dialog').open)$('#gift-dialog').close();
 if(['envelope','corridor'].includes(state)){portalReveal=0;$('#portal-flash').hidden=true;$('#portal-flash').style.opacity='0';}
 if(state==='opening'){
  openingPresented=false;
  scenes.letter.style.setProperty('--letter-stage-height',scenes.letter.getBoundingClientRect().height+'px');
 }

 document.body.dataset.stage=state;document.body.classList.toggle('is-model',modelStates.has(state));
 const theme=modelStates.has(state)?'#faf4e9':state==='party'?'#241b14':['envelope','opening','card','tearing','arrival'].includes(state)?'#09090b':'#0b0b0e';
 document.querySelector('meta[name="theme-color"]').content=theme;
 document.documentElement.style.backgroundColor=theme;document.documentElement.style.colorScheme=modelStates.has(state)?'light':'dark';
 scenes.letter.hidden=!['envelope','opening','card','tearing'].includes(state);scenes.candle.hidden=!['candle','wishing','listening','extinguishing'].includes(state);scenes.blessing.hidden=state!=='blessing';scenes.model.hidden=!modelStates.has(state);
 scenes.arrival.hidden=state!=='arrival';$('#continue-birthday').disabled=state!=='arrival';
 scenes.corridor.hidden=state!=='corridor';scenes.party.hidden=state!=='party';
 if(state==='corridor'){ensureCorridor();corridor?.resetGate();if(catalog)renderCorridorStep(corridorStep);}
 if(corridor)corridor.visible=state==='corridor';
 scenes.letter.className='scene letter-scene '+(state==='tearing'?'card tearing':['opening','card'].includes(state)?state:'')+(['card','tearing'].includes(state)?' present-card':'');$('#letter').hidden=!['opening','card','tearing'].includes(state);
 $('#open-letter').disabled=state!=='envelope';$('#accept-letter').disabled=state!=='card';$('#letter').inert=state!=='card';$('#open-letter').setAttribute('aria-hidden',String(state!=='envelope'));
 $('#start-wish').hidden=state!=='candle';$('#start-wish').disabled=state!=='candle';$('#mic-note').hidden=state!=='candle';
 $('#cake-stage').classList.toggle('extinguished',state==='extinguishing');$('#cake').setAttribute('aria-label',state==='extinguishing'?'蜡烛已经熄灭的蛋糕':'一支点亮的蜡烛和蛋糕');
 $('#making-records').hidden=!['final','party'].includes(state);$('#making-records').open=false;
 $('#loading-panel').hidden=state!=='loading'&&!loadError;
 if(figurine)figurine.visible=state==='exhibit'&&!loadError;
 $('#wish-status').textContent=state==='wishing'?'愿望正在被悄悄收好':state==='listening'?'现在轻轻吹一下':state==='extinguishing'?'愿望已收好':'';
 if(state==='candle'){$('#wish-hint').textContent='闭上眼睛在 10 秒里许下愿望';document.querySelectorAll('.wish-dot').forEach(d=>d.classList.remove('off'));$('#start-wish').focus({preventScroll:true});}
 if(state==='card'){ticket.reset();if(keyboardNavigation)$('#accept-letter').focus({preventScroll:true});}
 if(state==='tearing'){tearStart=ticket.progress;$('#letter').classList.add('is-torn');}
 if(state==='arrival'){scenes.arrival.style.setProperty('--arrival-progress',reduced.matches?1:0);$('#continue-birthday').focus({preventScroll:true});}
 if(state==='corridor')$('#corridor-action').focus({preventScroll:true});
 if(state==='exhibit'){if(!exhibitSession){figurine?.startTurn(reduced.matches);exhibitSession=true;}$('#leave-exhibit').focus({preventScroll:true});}
 if(state==='party')$('#revisit-corridor').focus({preventScroll:true});
 if(state==='opening'&&reduced.matches){scenes.letter.classList.add('present-card');openingPresented=true;}
 if(state==='opening'){
  ticket.reset();openingAnimations=[];openingPresentation=null;
  if(!reduced.matches){prepareOpeningPaper();openingAnimations=scenes.letter.getAnimations({subtree:true}).filter(a=>['lowerBirthdayEnvelope','emptyEnvelope','openBirthdayFlap','releaseBirthdaySeal','drawBirthdayCard'].includes(a.animationName));openingAnimations.forEach(a=>{a.pause();a.currentTime=0;});}
 }
 syncGiftButtons();
}
function getCatalog(){
 if(catalog)return Promise.resolve(catalog);
 if(!catalogPromise)catalogPromise=loadMemoryCatalog().then(value=>{
  catalog=value;const nav=$('.corridor-stops');nav.replaceChildren();
  catalog.stops.forEach((memory,step)=>{const button=document.createElement('button');button.type='button';button.dataset.stop=step;button.textContent=step===0?'入口':memory.navLabel;button.addEventListener('click',()=>{if(ritual.state==='corridor')corridor?.go(step);});nav.append(button);});
  return catalog;
 }).finally(()=>catalogPromise=null);
 return catalogPromise;
}
function renderCorridorStep(step){
 if(!catalog)return;corridorStep=Math.max(0,Math.min(step,catalog.lastStep));const memory=catalog.at(corridorStep);
 portalReveal=0;$('#portal-flash').hidden=true;$('#portal-flash').style.opacity='0';
 scenes.corridor.classList.toggle('birthday-stop',memory.kind==='birthday');scenes.corridor.classList.remove('gate-opening');
 $('#corridor-overline').textContent=memory.caption;$('#corridor-title').textContent=memory.title;$('#corridor-description').textContent=memory.description;
 const gatePending=memory.kind==='birthday'&&corridor&&!corridor.gate.ready;
 $('#corridor-action').firstChild.textContent=(gatePending?'正在准备森林入口':memory.actionLabel)+' ';$('#corridor-action').disabled=!corridor||gatePending;$('#corridor-position').textContent=corridorStep===0?'入口':memory.navLabel;
 $('#corridor-prev').disabled=corridorStep===0;$('#corridor-next').disabled=corridorStep===catalog.lastStep;
 const selected=document.querySelector('[data-stop="'+corridorStep+'"]');selected?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 document.querySelectorAll('[data-stop]').forEach(b=>{if(Number(b.dataset.stop)===corridorStep)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
}
function ensureCorridor(recreate=false){
 if(recreate){corridor?.dispose();corridor=null;}
 if(corridor)return;
 if(!catalog){
  $('#corridor-action').disabled=true;$('#corridor-error').hidden=false;$('#retry-corridor').hidden=true;$('#corridor-error-text').textContent='正在准备这些回忆';
  getCatalog().then(()=>{if(ritual.state==='corridor')ensureCorridor();}).catch(e=>{console.warn('Memory catalog loading failed:',e.message);if(ritual.state==='corridor'){$('#corridor-error-text').textContent='回忆暂时没有准备好请重新加载';$('#retry-corridor').hidden=false;}});return;
 }
 const step=corridorStep;
 $('#retry-corridor').hidden=false;
 try{corridor=new MemoryCorridor($('#corridor-host'),{catalog,onStep:renderCorridorStep,onDoorRequest:openBirthdayGate,onGateReady:()=>{if(ritual.state==='corridor')renderCorridorStep(corridorStep);},onError:message=>{if(message)$('#corridor-error-text').textContent=message;$('#corridor-error').hidden=!message;},reduced:()=>reduced.matches});corridor.go(step);corridor.visible=ritual.state==='corridor';$('#corridor-error').hidden=true;renderCorridorStep(step);}
 catch{$('#corridor-action').disabled=true;$('#corridor-error').hidden=false;$('#corridor-error-text').textContent='这个浏览器暂时无法打开三维回忆走廊请启用图形加速后重试';}
}
function openBirthdayGate(){
 if(ritual.state!=='corridor'||!corridor||corridorStep!==catalog?.lastStep)return;
 if(corridor.openDoor(()=>{scenes.corridor.classList.remove('gate-opening');portalReveal=reduced.matches?180:800;$('#portal-flash').style.opacity=reduced.matches?'.65':'1';ritual.wishRoom();})){
  $('#portal-flash').hidden=false;$('#portal-flash').style.opacity='0';$('#corridor-action').firstChild.textContent='正在穿过森林之门 ';$('#corridor-action').disabled=true;scenes.corridor.classList.add('gate-opening');
 }
}
function openMemory(){
 const memory=catalog?.at(corridorStep),dialog=$('#flower-memory');if(ritual.state!=='corridor'||dialog.open||!['quiz','photo','ornament'].includes(memory?.kind))return;
 currentMemory=memory;dialog.dataset.kind=memory.kind;if(memory.kind==='ornament'){snowflakeMemory.open(memory);return;}const state=memoryStates.get(memory.id)??{guess:'',revealed:false,feedback:''},quiz=memory.kind==='quiz';
 $('.flower-question .memory-overline').textContent=quiz?memory.quiz.heading:memory.caption;$('#flower-title').textContent=quiz?memory.quiz.prompt:memory.title;
 const photo=$('.flower-question img');photo.alt=quiz?'用于猜花名的花朵照片':memory.title;photo.style.aspectRatio='auto';photo.src=memory.image;$('#flower-photo-status').hidden=true;
 $('#flower-guess').hidden=!quiz;$('#flower-answer-input').value=state.guess;$('.memory-note').textContent=memory.reflection.join('\n');
 $('#flower-feedback').textContent=state.feedback;$('#flower-feedback').hidden=!quiz;$('#flower-answer h3').textContent=quiz?memory.quiz.answer:'';$('#flower-answer h3').hidden=!quiz;
 $('.flower-answer-fold').hidden=!quiz;$('.flower-answer-inside').hidden=quiz&&!state.revealed;$('#flower-answer').classList.toggle('is-open',!quiz||state.revealed);$('#flower-answer').style.height='';
 dialog.scrollTop=0;dialog.showModal();
}
function closeFlower(){if($('#flower-memory').open)$('#flower-memory').close();$('#corridor-action').focus({preventScroll:true});}
function syncGiftButtons(){
 const state=figurine?.gift.state;
 $('#retry-model').hidden=!loadError;
 $('#view-gift-coupon').hidden=!!loadError||ritual.state!=='exhibit'||!['offered','deferred','claimed'].includes(state);
 $('#view-gift-coupon').textContent=figurine?.gift.claimed?'查看领取券':'领取券';
}
function showGiftCoupon(){
 if(ritual.state!=='exhibit'||loadError||!figurine?.reopen())return;
 const claimed=figurine.gift.claimed,dialog=$('#gift-dialog');
 dialog.dataset.claimed=String(claimed);$('#gift-claim-title').textContent=claimed?'已领取':'是否领取';
 $('#claim-gift').hidden=claimed;$('#defer-gift').hidden=claimed;$('#close-gift-coupon').hidden=!claimed;
 if(!dialog.open)dialog.showModal();
 (claimed?$('#close-gift-coupon'):$('#claim-gift')).focus({preventScroll:true});
}
function prepareOpeningPaper(){
 const wrap=$('.envelope-wrap'),paper=$('.drawn-card'),letter=$('#letter'),mark=$('.letter-flower');
 const width=wrap.clientWidth,height=wrap.clientHeight,target=letter.getBoundingClientRect(),bounds=wrap.getBoundingClientRect();
 const matrix=new DOMMatrixReadOnly(getComputedStyle(wrap).transform),ratio=target.width/target.height;
 const minY=Math.min(0,matrix.b*width,matrix.d*height,matrix.b*width+matrix.d*height);
 const mouthY=bounds.top+matrix.b*width/2-minY;
 const safeHeight=(mouthY+56-$('header').getBoundingClientRect().bottom-16)/(matrix.d+Math.abs(matrix.b)*ratio/2);
 const paperHeight=Math.max(40,Math.min(height*.84,width*.84/ratio,safeHeight)),paperWidth=paperHeight*ratio;
 const paperTop=(height-paperHeight)/2;openingPaperScale=paperWidth/target.width;
 const properties={'--draw-width':paperWidth+'px','--draw-height':paperHeight+'px','--draw-top':paperTop+'px','--draw-distance':paperTop+paperHeight+'px','--draw-scale':openingPaperScale,'--draw-mark-top':mark.offsetTop*openingPaperScale+'px','--draw-mark-size':mark.offsetHeight*openingPaperScale+'px','--draw-mark-font':parseFloat(getComputedStyle(mark).fontSize)*openingPaperScale+'px'};
 // The extracted paper carries the same ink at the same relative positions.
 // Measure the final ticket rather than approximating its text with percentages.
 for(const [part,selector]of [['title','.ticket-overline'],['headline','#letter-title']]){
  const element=letter.querySelector(selector),box=element.getBoundingClientRect(),style=getComputedStyle(element);
  for(const [name,value]of Object.entries({left:box.left-target.left,top:box.top-target.top,width:box.width,font:parseFloat(style.fontSize),line:parseFloat(style.lineHeight),spacing:parseFloat(style.letterSpacing)||0})){
   properties['--draw-'+part+'-'+name]=value*openingPaperScale+'px';
  }
 }
 for(const [key,value]of Object.entries(properties))paper.style.setProperty(key,value);
 scenes.letter.style.setProperty('--card-from-angle',Math.atan2(matrix.b,matrix.a)*180/Math.PI+'deg');
}
function renderFrame(state,elapsed){
 if(state==='opening'&&!reduced.matches){openingAnimations.forEach(a=>a.currentTime=elapsed);if(openingPresentation)openingPresentation.currentTime=Math.max(0,elapsed-OPENING_HANDOFF);}
 if(state==='tearing'){const t=Math.min(1,elapsed/(reduced.matches?240:TIMES.tearing)),peel=reduced.matches?t:Math.min(1,t/.36),exit=reduced.matches?t:Math.max(0,Math.min(1,(t-.88)/.12)),fall=reduced.matches?0:Math.max(0,Math.min(1,(t-.36)/.64));ticket.setProgress(tearStart+(1-tearStart)*(.5-.5*Math.cos(peel*Math.PI)),exit,fall);}
 if(state==='arrival')scenes.arrival.style.setProperty('--arrival-progress',reduced.matches?1:Math.min(1,elapsed/2600));
 if(state==='opening'&&!openingPresented&&!reduced.matches&&elapsed>=OPENING_HANDOFF){
  const source=$('.drawn-card').getBoundingClientRect(),target=$('#letter').getBoundingClientRect();
  scenes.letter.style.setProperty('--card-from-x',(source.left+source.width/2-target.left-target.width/2)+'px');
  scenes.letter.style.setProperty('--card-from-y',(source.top+source.height/2-target.top-target.height/2)+'px');
  scenes.letter.style.setProperty('--card-from-scale',openingPaperScale);
  scenes.letter.classList.add('present-card');openingPresented=true;
  openingPresentation=$('#letter').getAnimations().find(a=>a.animationName==='presentBirthdayCard');if(openingPresentation){openingPresentation.pause();openingPresentation.currentTime=Math.max(0,elapsed-OPENING_HANDOFF);}
 }

 if(state==='wishing')document.querySelectorAll('.wish-dot').forEach((d,i)=>d.classList.toggle('off',elapsed>=(i+1)*1000));
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2600);}
function modelError(message){loadError=message;scenes.model.classList.toggle('load-error',!!message);if(message){ritual.setReady(false);$('#loading-text').textContent=message;$('#loading-panel').hidden=false;if(figurine)figurine.visible=false;}else{ritual.setReady(!!figurine?.ready);$('#loading-panel').hidden=ritual.state!=='loading';if(figurine)figurine.visible=ritual.state==='exhibit';}syncGiftButtons();}
async function loadModel(recreate=false){
 $('#loading-text').textContent='正在准备白模';loadError=null;scenes.model.classList.remove('load-error');syncGiftButtons();
 try{if(recreate){figurine?.dispose();figurine=null;exhibitSession=false;}
 if(!figurine)figurine=new WhiteGift($('#model-host'),{onProgress:text=>$('#loading-text').textContent=text,onError:modelError,onChange:syncGiftButtons,onOffer:showGiftCoupon});
 await figurine.load();loadError=null;ritual.setReady(true);$('#loading-panel').hidden=ritual.state!=='loading';syncGiftButtons();
 }catch(e){modelError(e.name==='TimeoutError'?'加载用时较长请检查网络后重试':e.name==='AbortError'?'加载已中断请重试':'礼物暂时没有加载完成请检查网络后重试');console.warn('Model loading failed:',e.message);}
}
$('#open-letter').addEventListener('click',()=>ritual.open());$('#start-wish').addEventListener('click',()=>ritual.start());
$('#continue-birthday').addEventListener('click',()=>ritual.arrive());
 $('#corridor-action').addEventListener('click',()=>{if(ritual.state!=='corridor'||!catalog||!corridor)return;const memory=catalog.at(corridorStep);if(corridorStep===0)corridor.go(1);else if(['quiz','photo','ornament'].includes(memory.kind))openMemory();else if(memory.kind==='figurine')ritual.visit();else if(memory.kind==='birthday')openBirthdayGate();});
 $('#corridor-prev').addEventListener('click',()=>corridor?.go(corridorStep-1));$('#corridor-next').addEventListener('click',()=>corridor?.go(corridorStep+1));
 $('#retry-corridor').addEventListener('click',()=>ensureCorridor(true));
 $('#leave-exhibit').addEventListener('click',()=>{ritual.leaveExhibit();window.scrollTo({top:0,behavior:'instant'});});
 $('#revisit-corridor').addEventListener('click',()=>{ritual.revisit();window.scrollTo({top:0,behavior:'instant'});});
 $('#close-memory').addEventListener('click',closeFlower);
 $('#flower-memory').addEventListener('close',()=>$('#corridor-action').focus({preventScroll:true}));
 const flowerPhoto=$('.flower-question img');flowerPhoto.addEventListener('error',()=>$('#flower-photo-status').hidden=false);flowerPhoto.addEventListener('load',()=>{flowerPhoto.width=flowerPhoto.naturalWidth;flowerPhoto.height=flowerPhoto.naturalHeight;$('#flower-photo-status').hidden=true;});
 if(flowerPhoto.complete&&!flowerPhoto.naturalWidth)$('#flower-photo-status').hidden=false;
 $('#retry-flower-photo').addEventListener('click',()=>{if(currentMemory)flowerPhoto.src=currentMemory.image+'?retry='+Date.now();});
 $('#flower-answer-input').addEventListener('input',()=>{if(currentMemory?.kind==='quiz'){const state=memoryStates.get(currentMemory.id)??{revealed:false,feedback:''};memoryStates.set(currentMemory.id,{...state,guess:$('#flower-answer-input').value});}});
 $('#flower-guess').addEventListener('submit',e=>{
  e.preventDefault();if(!$('#flower-memory').open||currentMemory?.kind!=='quiz')return;const answer=$('#flower-answer-input').value,feedback=catalog.accepts(currentMemory,answer)?'猜对了':answer.trim()?'翻开看看答案是':'答案是';$('#flower-feedback').textContent=feedback;memoryStates.set(currentMemory.id,{guess:answer,revealed:true,feedback});
  const panel=$('#flower-answer'),inside=$('.flower-answer-inside'),first=!panel.classList.contains('is-open');
  if(first&&!reduced.matches)panel.style.height=panel.getBoundingClientRect().height+'px';
  inside.hidden=false;panel.classList.add('is-open');
  if(first&&!reduced.matches){const height=panel.scrollHeight;requestAnimationFrame(()=>panel.style.height=height+'px');}
  $('#memory-continue').focus({preventScroll:true});
 });
 $('#flower-answer').addEventListener('transitionend',e=>{if(e.propertyName==='height')$('#flower-answer').style.height='';});
 $('#memory-continue').addEventListener('click',()=>{closeFlower();corridor?.go(corridorStep+1);});
$('#retry-model').addEventListener('click',()=>void loadModel(true));
$('#view-gift-coupon').addEventListener('click',showGiftCoupon);
$('#claim-gift').addEventListener('click',()=>{if(figurine?.claim())showGiftCoupon();});
$('#defer-gift').addEventListener('click',()=>{figurine?.defer();$('#gift-dialog').close();});
$('#gift-dialog').addEventListener('cancel',()=>figurine?.defer());
$('#gift-dialog').addEventListener('close',()=>{if(ritual.state==='exhibit')($('#view-gift-coupon').hidden?$('#leave-exhibit'):$('#view-gift-coupon')).focus({preventScroll:true});});
$('#close-gift-coupon').addEventListener('click',()=>{ritual.leaveExhibit();window.scrollTo({top:0,behavior:'instant'});});
function visibility(){if(document.hidden&&ticket.drag)ticket.cancel();ritual.pause(document.hidden);music.setHidden(document.hidden);document.body.classList.toggle('is-paused',document.hidden);last=performance.now();}
document.addEventListener('visibilitychange',visibility);
reduced.addEventListener('change',()=>{ritual.reduced=reduced.matches;});
function tick(now){if(stopped)return;const dt=Math.min(now-last,250);last=now;ritual.update(dt);if(!document.hidden){ticket.frame(dt);figurine?.frame(dt);if(!$('#flower-memory').open)corridor?.frame(dt);
 if(portalReveal>0){portalReveal=Math.max(0,portalReveal-dt);const total=reduced.matches?180:800,hold=reduced.matches?0:130,t=Math.max(0,Math.min(1,(total-portalReveal-hold)/(total-hold)));$('#portal-flash').style.opacity=String((reduced.matches?.65:1)*(1-t*t*(3-2*t)));if(!portalReveal)$('#portal-flash').hidden=true;}
 else if(ritual.state==='corridor'&&corridor?.gate.state==='opening')$('#portal-flash').style.opacity=String(corridor.gate.flash*(reduced.matches?.65:1));
 }animationFrame=requestAnimationFrame(tick);}
window.addEventListener('pagehide',()=>{if(ticket.drag)ticket.cancel();mic.stop();music.setAway(true);ritual.pause(true);stopped=true;cancelAnimationFrame(animationFrame);});
window.addEventListener('pageshow',e=>{music.setAway(false);if(e.persisted){stopped=false;visibility();last=performance.now();animationFrame=requestAnimationFrame(tick);}});
Object.defineProperty(window,'lcfState',{get:()=>({stage:ritual.state,elapsed:ritual.elapsed,paused:ritual.paused,micAvailable:mic.available,micTracks:mic.stream?.getTracks().filter(t=>t.readyState==='live').length||0,ticket:{progress:ticket.progress,detached:!!ticket.detached,exit:ticket.exit??0,float:ticket.float??0},music:music.snapshot(),model:figurine?.snapshot()??null,corridor:corridor?.snapshot()??null,catalogReady:!!catalog,memoryCount:catalog?.memories.length??0,memoryOpen:$('#flower-memory').open,memoryId:$('#flower-memory').open?currentMemory?.id:null,error:loadError})});
renderState('envelope');loadModel();animationFrame=requestAnimationFrame(tick);
// Preview destinations apply once; a refresh always starts at the invitation.
const entryParams=new URLSearchParams(location.search),isReload=performance.getEntriesByType('navigation')[0]?.type==='reload';
const requestedMemory=designPreview&&!isReload&&entryParams.get('memory'),previewView=designPreview&&!isReload&&entryParams.get('view'),previewCorridor=previewView==='corridor';
if(entryParams.has('memory')||entryParams.has('view')){const cleanEntry=new URL(location.href);cleanEntry.searchParams.delete('memory');cleanEntry.searchParams.delete('view');history.replaceState(history.state,'',cleanEntry.pathname+cleanEntry.search+cleanEntry.hash);}
if(requestedMemory||previewCorridor)ritual.enter('corridor');
else if(previewView==='party')ritual.enter('party');
getCatalog().then(()=>{if(requestedMemory&&ritual.state==='corridor'){const step=catalog.stepForId(requestedMemory);if(step){corridor?.go(step);openMemory();}}}).catch(()=>{});
if(document.modelContext?.registerTool){const ac=new AbortController();try{void Promise.resolve(document.modelContext.registerTool({name:'read_birthday_gift_state',description:'Read the visible birthday experience stage and model loading state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('No parameters expected');return window.lcfState;}},{signal:ac.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>ac.abort(),{once:true});}

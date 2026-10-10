const kinds=new Set(['quiz','photo','figurine','ornament','birthday']);
const text=(value,field)=>{if(typeof value!=='string'||!value.trim())throw Error('Missing text: '+field);return value;};
export function normalizeAnswer(value){return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s。！!？?，,]/g,'');}
export class MemoryCatalog {
 constructor(data){
  if(data?.version!==1||!Array.isArray(data.memories)||!data.memories.length||data.memories.length>50)throw Error('Unsupported memory catalog');
  for(const key of ['caption','title','description','actionLabel'])text(data.entry?.[key],'entry.'+key);
  const ids=new Set();
  for(const m of data.memories){
   if(typeof m.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(m.id)||ids.has(m.id))throw Error('Duplicate or invalid memory id');ids.add(m.id);
   if(!kinds.has(m.kind))throw Error('Unknown memory kind');
   if(m.enabled!==undefined&&typeof m.enabled!=='boolean')throw Error('Invalid memory enabled flag');
   for(const key of ['navLabel','caption','title','description','actionLabel'])text(m[key],m.id+'.'+key);
   if(m.kind!=='birthday'&&(!/^\.\/assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(m.image||'')))throw Error('Memory image must be a local asset');
   if(['quiz','photo'].includes(m.kind)&&(!Array.isArray(m.reflection)||!m.reflection.length||m.reflection.some(v=>typeof v!=='string')))throw Error('Missing memory reflection');
   if(m.kind==='quiz'){
    for(const key of ['heading','prompt','answer'])text(m.quiz?.[key],m.id+'.quiz.'+key);
    if(!Array.isArray(m.quiz.acceptedAnswers)||!m.quiz.acceptedAnswers.length||m.quiz.acceptedAnswers.some(v=>typeof v!=='string'||!normalizeAnswer(v)))throw Error('Missing quiz answers');
   }
  }
  const copy=structuredClone(data);this.entry=copy.entry;this.memories=copy.memories.filter(m=>m.enabled!==false);
  if(!this.memories.length||this.memories.at(-1).kind!=='birthday'||this.memories.filter(m=>m.kind==='birthday').length!==1)throw Error('Birthday must be the final enabled stop');
  this.stops=[this.entry,...this.memories];
 }
 at(step){return this.stops[step]??null;}
 stepForId(id){return this.memories.findIndex(m=>m.id===id)+1;}
 accepts(memory,guess){return memory?.kind==='quiz'&&memory.quiz.acceptedAnswers.some(a=>normalizeAnswer(a)===normalizeAnswer(guess));}
 get lastStep(){return this.stops.length-1;}
 layout(){
  let wallIndex=0;const walls=[];
  for(let step=1;step<this.stops.length;step++){
   const memory=this.stops[step];if(memory.kind==='birthday')continue;
   const side=wallIndex%2===0?-1:1,z=-1.4-wallIndex*3.6;
   walls.push({step,id:memory.id,side,z,memory,position:[0,1.45,z+2],target:[side*2.1,1.6,z]});wallIndex++;
  }
  const doorZ=(walls.at(-1)?.z??-1.4)-6.7;
  const stops=[{position:[0,1.48,3.8],target:[0,1.35,doorZ+4]}];
  for(const wall of walls)stops[wall.step]={position:wall.position,target:wall.target};
  stops[this.lastStep]={position:[0,1.43,doorZ+4.2],target:[0,1.4,doorZ]};
  return {walls,stops,doorZ,length:4.5-doorZ,centerZ:(4.4+doorZ-.1)/2};
 }
}
export async function loadMemoryCatalog(url='./assets/memories.json'){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('Memory catalog download failed');return new MemoryCatalog(await response.json());}
 finally{clearTimeout(timer);}
}

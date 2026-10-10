import {FrontColourFlow} from './front-colour-flow.js?v=edecaf95d8e0';

const PALETTE=['#f58fa7','#a3dfea','#d5e9a2','#efbe70','#fff5de'];
export class FrontPortrait {
 constructor(host,{onProgress=()=>{},onError=()=>{},onChange=()=>{}}={}){
  Object.assign(this,{host,onProgress,onError,onChange,ready:false,visible:false,loading:null,lost:false,auto:false});
  this.flow=new FrontColourFlow();this.particles=[];this.emission=0;
  this.canvas=document.createElement('canvas');this.canvas.id='front-portrait-canvas';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','铃铛正面白模');
  this.canvas.width=1024;this.canvas.height=1280;host.replaceChildren(this.canvas);
  this.context=this.canvas.getContext('2d');this.whiteCanvas=document.createElement('canvas');this.colourCanvas=document.createElement('canvas');this.revealCanvas=document.createElement('canvas');this.maskCanvas=document.createElement('canvas');
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
 }
 async image(record,signal){
  const response=await fetch(record.url,{signal});if(!response.ok)throw Error('正面图暂时无法读取');
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw Error('正面图不完整');
  const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==record.sha256)throw Error('正面图版本不匹配');
  const objectURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
  try{const image=new Image();image.src=objectURL;await image.decode();if(signal.aborted)throw new DOMException('Aborted','AbortError');return image;}
  finally{URL.revokeObjectURL(objectURL);}
 }
 async load(){
  if(this.ready)return;if(this.loading)return this.loading;
  this.abort?.abort();this.abort=new AbortController();const signal=this.abort.signal;
  const timeout=setTimeout(()=>this.abort.abort(new DOMException('Timeout','TimeoutError')),30000);
  this.loading=(async()=>{
   this.onProgress('正在准备正面图');
   const response=await fetch('./assets/model-manifest.json',{signal,cache:'no-cache'});if(!response.ok)throw Error('资源清单暂时无法读取');
   this.manifest=await response.json();const portrait=this.manifest.frontPortrait;if(!portrait?.runtimeAllowed)throw Error('正面图尚未准备好');
   const [white,colour,silhouette]=await Promise.all([this.image(portrait.white,signal),this.image(portrait.colour,signal),this.image(portrait.silhouette,signal)]);
   if(white.naturalWidth!==portrait.white.width||white.naturalHeight!==portrait.white.height||colour.naturalWidth!==portrait.colour.width||colour.naturalHeight!==portrait.colour.height)throw Error('正面图尺寸不匹配');
   if(silhouette.naturalWidth!==portrait.silhouette.width||silhouette.naturalHeight!==portrait.silhouette.height)throw Error('正面轮廓尺寸不匹配');
   this.white=white;this.colour=colour;this.silhouette=silhouette;
   // Use the captured sculpture silhouette in the live compositor so transparent
   // edge residue from image editing cannot spill into the surrounding stage.
   for(const [canvas,image]of [[this.whiteCanvas,white],[this.colourCanvas,colour]]){
    canvas.width=silhouette.naturalWidth;canvas.height=silhouette.naturalHeight;
    const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
    context.globalCompositeOperation='destination-in';context.drawImage(silhouette,0,0);context.globalCompositeOperation='source-over';
   }
   this.ready=true;this.resize();this.reset();this.onProgress('正面图已准备好');
  })().catch(error=>{this.ready=false;throw error;}).finally(()=>{clearTimeout(timeout);this.loading=null;});return this.loading;
 }
 resize(){
  const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight),ratio=Math.min(devicePixelRatio||1,1.5);
  this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
  this.revealCanvas.width=this.canvas.width;this.revealCanvas.height=this.canvas.height;this.maskCanvas.width=this.canvas.width;this.maskCanvas.height=this.canvas.height;
  if(this.ready)this.draw();
 }
 reset(){this.flow.reset();this.particles=[];this.emission=0;this.canvas.setAttribute('aria-label','铃铛正面白模');this.draw();this.onChange(this.snapshot());}
 startColour(reduced=false){if(!this.ready||!this.visible||!this.flow.start(reduced))return false;this.canvas.setAttribute('aria-label','铃铛正面正在上颜色');this.onChange(this.snapshot());return true;}
 setInteractive(){}
 frame(dt){
  if(!this.ready||!this.visible)return;
  if(this.flow.state!=='colouring'&&!this.particles.length)return;
  const before=this.flow.state;this.flow.update(dt);const seconds=Math.max(0,Math.min(250,dt))/1000;
  if(!this.flow.reduced&&this.flow.state==='colouring'&&this.flow.progress<.88){
   this.emission=Math.min(12,this.emission+seconds*65);
   while(this.emission>=1&&this.particles.length<145){this.emission--;const seed=Math.random();this.particles.push({x:.43+(Math.random()-.5)*.13,y:.107-Math.random()*.032,vx:(Math.random()-.5)*.22,vy:.13+Math.random()*.13,age:0,life:2.4+Math.random()*1.3,r:.0017+Math.random()*.0026,seed,colour:PALETTE[Math.floor(Math.random()*PALETTE.length)]});}
  }
  for(const particle of this.particles){particle.age+=seconds;particle.vy+=seconds*.095;particle.y+=particle.vy*seconds;particle.x+=(particle.vx+Math.sin(particle.age*4+particle.seed*10)*.025)*seconds;}
  this.particles=this.particles.filter(p=>p.age<p.life&&p.y<1.02&&p.x>.1&&p.x<.9);
  if(this.flow.state==='coloured')this.particles=[];
  this.draw();if(before!==this.flow.state){this.canvas.setAttribute('aria-label','铃铛正面彩图');this.onChange(this.snapshot());}
 }
 draw(){
  if(!this.ready)return;const context=this.context,w=this.canvas.width,h=this.canvas.height,p=this.flow.progress;
  context.clearRect(0,0,w,h);context.drawImage(this.whiteCanvas,0,0,w,h);
  if(p>0){
   const reveal=this.revealCanvas.getContext('2d');reveal.clearRect(0,0,w,h);reveal.globalCompositeOperation='source-over';reveal.drawImage(this.colourCanvas,0,0,w,h);
   if(p<1){
    const mask=this.maskCanvas.getContext('2d');mask.clearRect(0,0,w,h);
    if(this.flow.reduced){mask.fillStyle=`rgba(255,255,255,${p})`;mask.fillRect(0,0,w,h);}
    else{
     const phase=Math.max(0,Math.min(1,(this.flow.elapsed-240)/3900)),front=.092+phase*1.04;
     // Individual short streams soften the moving edge without drawing a line.
     for(let x=0;x<w;x+=Math.max(2,w/100)){
      const u=x/w,wave=Math.sin(u*47)*.009+Math.sin(u*91+1)*.004,position=(front+wave)*h;
      const gradient=mask.createLinearGradient(0,position-.018*h,0,position+.025*h);gradient.addColorStop(0,'#fff');gradient.addColorStop(1,'#ffffff00');
      mask.fillStyle=gradient;mask.fillRect(x,0,Math.max(2,w/100)+1,h);
     }
    }
    reveal.globalCompositeOperation='destination-in';reveal.drawImage(this.maskCanvas,0,0);reveal.globalCompositeOperation='source-over';
   }
   context.drawImage(this.revealCanvas,0,0);
  }
  if(this.particles.length){
   context.save();context.globalCompositeOperation='source-over';
   for(const particle of this.particles){
    const alpha=Math.min(1,particle.age/.1)*Math.max(0,Math.min(1,(particle.life-particle.age)/.65))*.65,r=particle.r*w;
    context.globalAlpha=alpha;context.strokeStyle=particle.colour;context.lineWidth=r*.6;context.beginPath();context.moveTo(particle.x*w,particle.y*h);context.lineTo((particle.x-particle.vx*.025)*w,(particle.y-particle.vy*.027)*h);context.stroke();
    context.fillStyle=particle.colour;context.shadowColor=particle.colour;context.shadowBlur=r*2;context.beginPath();context.arc(particle.x*w,particle.y*h,r,0,Math.PI*2);context.fill();
   }
   context.restore();
  }
 }
 snapshot(){return {kind:'front-portrait',fixedFront:true,ready:this.ready,...this.flow.snapshot(),particles:this.particles.length,rotation:0,auto:false,interactive:false,whiteSHA256:this.manifest?.frontPortrait?.white.sha256??null,colourSHA256:this.manifest?.frontPortrait?.colour.sha256??null,silhouetteSHA256:this.manifest?.frontPortrait?.silhouette.sha256??null,sourceModelSHA256:this.manifest?.sourceModel?.sha256??null,modelSHA256:this.manifest?.model.sha256??null};}
 dispose(){this.abort?.abort();this.observer.disconnect();this.particles=[];this.canvas.remove();this.ready=false;}
}

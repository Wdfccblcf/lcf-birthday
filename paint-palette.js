import{PIGMENTS}from'./paint-flow.js';

export class PaintPalette{
 constructor(host,{canvasHost,canPaint=()=>false,pour=()=>false,snapshot=()=>null}={}){
  Object.assign(this,{host,canvasHost,canPaint,pour,snapshot,drag:null,suppressUntil:0});
  host.innerHTML='<p class="paint-instruction">按住颜料 向手办划过去</p><div class="pigment-row" role="group" aria-label="给铃铛上色的颜料"></div><p class="paint-status sr-only" role="status" aria-live="polite"></p>';
  this.status=host.querySelector('.paint-status');const row=host.querySelector('.pigment-row');
  this.buttons=PIGMENTS.map((pigment,index)=>{
   const button=document.createElement('button');button.type='button';button.className='pigment-bucket';button.dataset.pigment=index;button.style.setProperty('--pigment',pigment.color);button.setAttribute('aria-label',pigment.name+'颜料');
   button.innerHTML='<span class="bucket-object" aria-hidden="true"><span class="bucket-handle"></span><span class="bucket-body"></span><span class="bucket-rim"></span><span class="bucket-check">✓</span></span><span class="bucket-name">'+pigment.name+'</span>';
   row.append(button);
   button.addEventListener('pointerdown',event=>this.begin(event,index,button));
   button.addEventListener('pointermove',event=>this.move(event));
   button.addEventListener('pointerup',event=>this.finish(event));
   button.addEventListener('pointercancel',()=>this.cancel());
   button.addEventListener('lostpointercapture',()=>this.cancel());
   button.addEventListener('click',()=>{if(performance.now()<this.suppressUntil)return;const rect=canvasHost.getBoundingClientRect(),origin=button.getBoundingClientRect();this.cast(index,[origin.left+origin.width/2,origin.top+22],[rect.left+rect.width/2,rect.top+rect.height*.34]);});
   return button;
  });this.sync();
 }
 begin(event,index,button){if(event.button!==0||!this.canPaint()||this.snapshot()?.active>=0)return;event.preventDefault();this.cancel();const rect=button.getBoundingClientRect();this.drag={id:event.pointerId,index,button,origin:[rect.left+rect.width/2,rect.top+25],start:[event.clientX,event.clientY],last:[event.clientX,event.clientY]};button.setPointerCapture(event.pointerId);button.classList.add('held');this.cursor=document.createElement('i');this.cursor.className='paint-cursor';this.cursor.style.setProperty('--pigment',PIGMENTS[index].color);document.body.append(this.cursor);this.move(event);}
 move(event){if(!this.drag||event.pointerId!==this.drag.id)return;this.drag.last=[event.clientX,event.clientY];this.cursor.style.left=event.clientX+'px';this.cursor.style.top=event.clientY+'px';const dist=Math.hypot(event.clientX-this.drag.start[0],event.clientY-this.drag.start[1]);this.cursor.classList.toggle('moving',dist>12);}
 finish(event){if(!this.drag||event.pointerId!==this.drag.id)return;const drag=this.drag,end=[event.clientX,event.clientY],dist=Math.hypot(end[0]-drag.start[0],end[1]-drag.start[1]),rect=this.canvasHost.getBoundingClientRect();const toward=end[1]<drag.start[1]-22&&end[0]>rect.left-35&&end[0]<rect.right+35;this.suppressUntil=performance.now()+500;this.cancel();if(dist>26&&toward)this.cast(drag.index,drag.origin,end);else if(dist<12)this.cast(drag.index,drag.origin,[rect.left+rect.width/2,rect.top+rect.height*.34]);}
 cast(index,origin,target){if(!this.canPaint()||!this.pour(index))return false;this.status.textContent=PIGMENTS[index].name+'颜料正在淋满手办并慢慢流下来';this.sync();const blob=document.createElement('i');blob.className='paint-flight';blob.style.setProperty('--pigment',PIGMENTS[index].color);blob.style.left=origin[0]+'px';blob.style.top=origin[1]+'px';document.body.append(blob);const dx=target[0]-origin[0],dy=target[1]-origin[1];const animation=blob.animate([{transform:'translate(-50%,-50%) scale(.55)',opacity:1},{transform:`translate(calc(-50% + ${dx*.48}px),calc(-50% + ${dy*.62}px)) scale(.85,1.25)`,opacity:1,offset:.6},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(3.8,.65)`,opacity:0}],{duration:360,easing:'cubic-bezier(.15,.6,.35,1)',fill:'forwards'});animation.finished.then(()=>blob.remove(),()=>blob.remove());return true;}
 cancel(){if(this.drag){const drag=this.drag;this.drag=null;drag.button.classList.remove('held');if(drag.button.hasPointerCapture(drag.id))drag.button.releasePointerCapture(drag.id);}this.cursor?.remove();this.cursor=null;}
 sync(){const state=this.snapshot(),allowed=this.canPaint(),key=String(allowed)+':'+(state?.active??-1)+':'+(state?.values??[]).map(v=>v===1?'1':'0').join('');if(key===this.lastKey)return;this.lastKey=key;this.buttons.forEach((button,i)=>{const done=state?.values?.[i]===1;button.disabled=!allowed||state?.active>=0;button.classList.toggle('used',done);button.setAttribute('aria-label',PIGMENTS[i].name+'颜料'+(done?'已留下颜色':''));});if(state?.active<0)this.status.textContent=state.completed===PIGMENTS.length?'铃铛的颜色都留下来了':state.completed?'已留下'+state.completed+'种颜色':'';}
}

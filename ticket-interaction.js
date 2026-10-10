// Pointer input controls the tear gesture; Ritual owns its completion clock.
export class TicketInput {
  constructor(ticket,stub,{canInteract,onTear}){
    Object.assign(this,{ticket,stub,canInteract,onTear,progress:0,ignoreClickUntil:0});
    this.buildPaper();
    this.paperObserver=new ResizeObserver(()=>{
      if(!stub.clientWidth||!stub.clientHeight)return;
      if(this.paperSize&&this.paperSize.width===stub.clientWidth&&this.paperSize.height===stub.clientHeight)return;
      if(this.drag)this.cancel();
      this.setProgress(this.progress,this.exit??null,this.float??0);
    });
    this.paperObserver.observe(stub);
    stub.addEventListener('pointerdown',e=>this.down(e));
    stub.addEventListener('pointermove',e=>this.move(e));
    stub.addEventListener('pointerup',e=>this.up(e));
    stub.addEventListener('pointercancel',()=>this.cancel());
    stub.addEventListener('lostpointercapture',()=>{if(this.drag)this.cancel();});
    stub.addEventListener('click',e=>{if(e.detail&&performance.now()<this.ignoreClickUntil){e.preventDefault();return;}this.tear();});
  }
  buildPaper(){
    const visual=document.createElement('span');visual.className='stub-visual';visual.setAttribute('aria-hidden','true');
    this.paper=document.createElement('canvas');this.paper.className='stub-paper';this.source=document.createElement('canvas');visual.append(this.paper);
    this.stub.append(visual);this.stub.classList.add('has-paper');
  }
  measurePaper(){
    const bounds=this.stub.getBoundingClientRect();if(!bounds.height)return;
    // Measure the layout paper, not the moving/scaled presentation rectangle.
    const w=this.stub.clientWidth,h=this.stub.clientHeight,dpr=Math.min(2,devicePixelRatio||1),ctx=this.source.getContext('2d'),style=getComputedStyle(this.stub),sx=bounds.width/w,sy=bounds.height/h;
    this.source.width=Math.ceil(w*dpr);this.source.height=Math.ceil(h*dpr);ctx.scale(dpr,dpr);
    const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#202022');gradient.addColorStop(.65,'#19191b');gradient.addColorStop(1,'#171719');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#c5a05b88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,.5);ctx.lineTo(w,.5);ctx.moveTo(0,h-.5);ctx.lineTo(w,h-.5);ctx.stroke();
    const inset=parseFloat(style.getPropertyValue('--ticket-inset'))||15;
    for(const [offset,color]of [[.5,'#d4ae6257'],[4.5,'#b68b3e20']]){ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(0,inset+offset);ctx.lineTo(w-inset-offset,inset+offset);ctx.lineTo(w-inset-offset,h-inset-offset);ctx.lineTo(0,h-inset-offset);ctx.stroke();}
    const label=this.stub.querySelector(':scope > .ticket-stub-label'),lr=label.getBoundingClientRect(),ls=getComputedStyle(label),font=parseFloat(ls.fontSize),spacing=parseFloat(ls.letterSpacing)||0;
    ctx.font=`${font}px ${ls.fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ddbd82';
    [...label.textContent].forEach((char,i)=>ctx.fillText(char,(lr.left-bounds.left+lr.width/2)/sx,(lr.top-bounds.top)/sy+font*.6+i*(font+spacing)));
    const arrow=this.stub.querySelector(':scope > .ticket-stub-arrow').getBoundingClientRect(),ax=(arrow.left-bounds.left)/sx,ay=(arrow.top-bounds.top+arrow.height/2)/sy,aw=arrow.width/sx;
    ctx.strokeStyle='#b3945b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+aw,ay);ctx.moveTo(ax+aw-5,ay-4);ctx.lineTo(ax+aw,ay);ctx.lineTo(ax+aw-5,ay+4);ctx.stroke();
    const notch=parseFloat(style.getPropertyValue('--ticket-notch'))||9;ctx.globalCompositeOperation='destination-out';for(const [x,y]of [[0,0],[0,h],[w,h/2]]){ctx.beginPath();ctx.arc(x,y,notch,0,Math.PI*2);ctx.fill();}ctx.globalCompositeOperation='source-over';
    this.paper.width=Math.ceil((w+66)*dpr);this.paper.height=Math.ceil((h+84)*dpr);this.paper.style.width=w+66+'px';this.paper.style.height=h+84+'px';
    this.paperSize={width:w,height:h,dpr};
  }
  down(e){
    if(!this.canInteract()||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
    this.returning=null;
    this.ticket.classList.remove('is-returning');
    this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};
    this.stub.setPointerCapture(e.pointerId);this.ticket.classList.add('is-dragging');
  }
  move(e){
    if(!this.drag||e.pointerId!==this.drag.id)return;
    if(!this.canInteract()){this.cancel();return;}
    const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
    this.drag.distance=Math.hypot(dx,dy);
    // Pull the outer edge rightwards or downwards; inward pushes do not tear it.
    this.setProgress(Math.min(.82,Math.hypot(Math.max(0,dx),Math.max(0,dy))/92));
    if(this.drag.distance>5)e.preventDefault();
  }
  up(e){
    if(!this.drag||e.pointerId!==this.drag.id)return;
    const moved=this.drag.distance>5;
    this.release();
    if(!moved){this.setProgress(0);return;}
    this.ignoreClickUntil=performance.now()+450;
    if(this.progress>=.68)this.tear();else this.returnStub();
  }
  release(){
    const id=this.drag?.id;this.drag=null;this.ticket.classList.remove('is-dragging');
    if(id!==undefined&&this.stub.hasPointerCapture(id))this.stub.releasePointerCapture(id);
  }
  tear(){if(!this.canInteract())return;this.returning=null;this.release();this.ticket.classList.remove('is-returning');this.onTear();}
  cancel(){if(this.drag)this.ignoreClickUntil=performance.now()+450;this.release();this.returnStub();}
  returnStub(){this.ticket.classList.add('is-returning');if(matchMedia('(prefers-reduced-motion: reduce)').matches)this.setProgress(0);else this.returning={from:this.progress,elapsed:0};}
  frame(dt){if(!this.returning)return;this.returning.elapsed+=dt;const t=Math.min(1,this.returning.elapsed/380);this.setProgress(this.returning.from*Math.pow(1-t,3));if(t===1)this.returning=null;}
  reset(){this.returning=null;this.release();this.ticket.classList.remove('is-torn','is-returning');this.measurePaper();this.setProgress(0);}
  setProgress(value,exit=null,float=0){
    this.progress=Math.max(0,Math.min(1,value));
    const bounds=this.ticket.getBoundingClientRect();
    if(!this.paperSize||this.paperSize.width!==this.stub.clientWidth||this.paperSize.height!==this.stub.clientHeight)this.measurePaper();
    const clamp=v=>Math.max(0,Math.min(1,v)),room=Math.max(0,innerWidth-bounds.right-4),pull=Math.min(44,room*.7);
    const p=this.progress,torn=this.ticket.classList.contains('is-torn'),front=p*(torn?1.32:1.18),release=torn?clamp((p-.79)/.21):0;
    this.ticket.style.setProperty('--tear-progress',p);this.ticket.style.setProperty('--rip-reveal',clamp(front));
    this.detached=torn&&p===1;this.exit=exit??(torn?clamp((p-.88)/.12):0);this.float=clamp(float);
    this.ticket.style.setProperty('--paper-release',release);this.ticket.style.setProperty('--ticket-exit',this.exit);
    if(!this.paperSize)return;
    const {width:w,height:h,dpr}=this.paperSize,ctx=this.paper.getContext('2d');ctx.clearRect(0,0,this.paper.width,this.paper.height);
    const falling=this.detached?this.float:0,sway=-w*.12*falling+Math.sin(falling*Math.PI*2.2)*Math.min(room*.25,5),fall=150*(.3*falling+.7*falling*falling),angle=-8*Math.sin(falling*Math.PI*1.55);
    this.paper.style.transformOrigin=`${w/2}px ${h/2}px`;this.paper.style.transform=`translate(${sway}px,${fall}px) rotate(${angle}deg)`;
    // Bend along the length of the sheet. Its two sides remain parallel: a
    // cosine squeeze across its width made the previous sheet look like a funnel.
    const surface=row=>{
      const linear=clamp((front-row)/.32),curl=linear*linear*(3-2*linear),wave=Math.sin(row*Math.PI*1.15+falling*.45),projected=w*(1-curl*.095);
      const gap=release*Math.min(room*.55,9),x=Math.min(room+w-projected-2,gap+curl*(pull*(1-row*.58)+w*.16*wave));
      const y=row*h+release*8-curl*(1-row)*Math.min(25,h*.12)+curl*Math.sin(row*Math.PI)*h*.035;
      return {curl,projected,x,y};
    };
    // Sample each destination pixel once. Overlapping stretched source rows
    // introduce horizontal seams, especially in the dark semi-transparent ink.
    const rows=Array.from({length:this.source.height+1},(_,i)=>surface(i/this.source.height));
    let sourceLine=0;
    for(let line=Math.ceil((rows[0].y+28)*dpr);line<(rows.at(-1).y+28)*dpr;line++){
      const paperY=(line+.5)/dpr-28;
      while(sourceLine<this.source.height-1&&rows[sourceLine+1].y<paperY)sourceLine++;
      const a=rows[sourceLine],b=rows[sourceLine+1],span=b.y-a.y,t=clamp((paperY-a.y)/span),curl=a.curl+(b.curl-a.curl)*t,px=(a.x+(b.x-a.x)*t)*dpr,pw=(a.projected+(b.projected-a.projected)*t)*dpr;
      const sampleHeight=1/(span*dpr),sampleY=Math.max(0,Math.min(this.source.height-sampleHeight,sourceLine+t-sampleHeight/2));
      ctx.drawImage(this.source,0,sampleY,this.source.width,sampleHeight,px,line,pw,1);
      if(curl>.001){ctx.globalCompositeOperation='source-atop';const shade=ctx.createLinearGradient(px,0,px+pw,0);shade.addColorStop(0,`rgba(242,215,161,${curl*.20})`);shade.addColorStop(.18,`rgba(242,215,161,${curl*.05})`);shade.addColorStop(.7,`rgba(0,0,0,${curl*.15})`);shade.addColorStop(1,`rgba(242,215,161,${curl*.17})`);ctx.fillStyle=shade;ctx.fillRect(px,line,pw,1);ctx.globalCompositeOperation='source-over';}
    }
    this.paper.style.top='-28px';
  }
}

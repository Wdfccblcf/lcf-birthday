// The saved component has its own Three.js import map and Rapier runtime.
// Mount only while its memory is open; the existing corridor clock pauses there.
export class SnowflakeMemory {
  constructor(dialog) {
    this.dialog=dialog;
    this.phase='closed';
    this.frame=null;
    this.panel=document.createElement('section');
    this.panel.className='snowflake-memory-panel';
    this.panel.hidden=true;
    this.panel.innerHTML='<header class="snowflake-memory-heading"><h2 id="snowflake-memory-title">雪花吊饰</h2></header><div class="snowflake-memory-stage"><p class="snowflake-memory-status" role="status"></p></div><p class="snowflake-memory-hint">轻轻拨动，银环缓缓回位，吊坠轻轻回摆</p>';
    dialog.append(this.panel);
    this.stage=this.panel.querySelector('.snowflake-memory-stage');
    this.status=this.panel.querySelector('.snowflake-memory-status');
    const style=document.createElement('link');
    style.rel='stylesheet';style.href=new URL('./snowflake-memory.css?v=12-edge-free',import.meta.url).href;
    document.head.append(style);
    dialog.addEventListener('close',()=>this.close());
    document.addEventListener('visibilitychange',()=>this.preview()?.pause(document.hidden));
    window.addEventListener('pagehide',()=>this.close());
    window.addEventListener('message',event=>{
      if(!this.frame||event.origin!==location.origin||event.source!==this.frame.contentWindow)return;
      if(event.data?.type==='snowflake-preview-close'){if(this.dialog.open)this.dialog.close();return;}
      if(event.data?.type!=='snowflake-preview-status')return;
      this.phase=event.data.phase==='ready'?'ready':'error';
      this.status.hidden=this.phase==='ready';
      if(this.phase==='error')this.status.textContent='吊饰暂时未能载入，收起后重新打开即可';
      if(this.phase==='ready')this.preview()?.pause(document.hidden);
    });
  }
  preview(){return this.frame?.contentWindow?.snowflakePreview??null;}
  open(memory){
    this.close();
    this.phase='loading';
    this.panel.hidden=false;
    this.dialog.dataset.kind='ornament';
    this.dialog.setAttribute('aria-labelledby','snowflake-memory-title');
    this.panel.querySelector('h2').textContent=memory.title;
    this.status.hidden=false;
    this.status.textContent='正在准备雪花与银环';
    const frame=document.createElement('iframe');
    frame.title='可以直接拨动的雪花吊饰';
    frame.id='snowflake-memory-frame';
    frame.src=new URL('./snowflake/index.html?v=12-card-framing',import.meta.url).href;
    this.frame=frame;
    this.stage.append(frame);
    this.dialog.scrollTop=0;
    this.dialog.showModal();
    this.dialog.querySelector('#close-memory').focus({preventScroll:true});
  }
  close(){
    this.preview()?.dispose();
    this.frame?.remove();
    this.frame=null;
    this.panel.hidden=true;
    this.phase='closed';
    this.dialog.setAttribute('aria-labelledby','flower-title');
  }
  snapshot(){return {phase:this.phase,frameCount:this.dialog.querySelectorAll('#snowflake-memory-frame').length,model:this.preview()?.snapshot()??null};}
}

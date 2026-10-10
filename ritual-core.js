export const TIMES = Object.freeze({ opening:2800, tearing:3300, wishing:10000, listening:4000, extinguishing:1000, blessing:4000, revealing:1200, white:12000, pause:500, coloring:12000 });
// A single foreground-time clock owns the entire ceremony. Browser permission
// prompts and slow assets never own or block a state transition.
export class Ritual {
  constructor({onState=()=>{},onFrame=()=>{},microphone,reduced=false,party=false}={}) {
    Object.assign(this,{onState,onFrame,microphone,reduced,party,state:'envelope',elapsed:0,ready:false,paused:false,generation:0});
  }
  enter(state) { this.state=state;this.elapsed=0;this.onState(state); }
  open() { if(this.state==='envelope')this.enter('opening'); }
  accept() { if(this.state==='card')this.enter('tearing'); }
  arrive() { if(this.state==='arrival')this.enter(this.party?'corridor':'candle'); }
  visit() { if(this.party&&this.state==='corridor')this.enter(this.ready?'exhibit':'loading'); }
  leaveExhibit() { if(this.party&&['exhibit','loading'].includes(this.state)){this.recovery=null;this.enter('corridor');} }
  wishRoom() { if(this.party&&['corridor','party'].includes(this.state))this.enter('candle'); }
  revisit() { if(this.party&&this.state==='party')this.enter('corridor'); }
  start() { if(this.state!=='candle')return;this.generation++;this.enter('wishing');void this.microphone?.start(); }
  extinguish() { if(!['wishing','listening'].includes(this.state))return;this.microphone?.stop();this.enter('extinguishing'); }
  replay() { if(!['final','party'].includes(this.state))return;this.generation++;this.microphone?.stop();this.enter('candle'); }
  setReady(ready) {
    this.ready=ready;
    if(!ready&&['revealing','white','pause','coloring','final','exhibit'].includes(this.state)){
      this.recovery={state:this.state,elapsed:this.elapsed};this.enter('loading');
    }else if(ready&&this.state==='loading'){
      const recovery=this.recovery;this.recovery=null;this.enter(recovery?.state??(this.party?'exhibit':'revealing'));
      if(recovery){this.elapsed=recovery.elapsed;this.onFrame(this.state,this.elapsed);}
    }
  }
  pause(value) {this.paused=value;this.microphone?.setPaused?.(value);}
  update(dt) {
    if(this.paused)return;
    this.elapsed+=Math.max(0,dt);
    const s=this.state,e=this.elapsed;
    if(s==='opening'&&e>=(this.reduced?350:TIMES.opening))this.enter('card');
    else if(s==='tearing'&&e>=(this.reduced?240:TIMES.tearing))this.enter('arrival');
    else if(s==='wishing') {
      this.microphone?.sample(false,dt);
      if(e>=TIMES.wishing) {if(this.microphone?.available)this.enter('listening');else this.extinguish();}
    } else if(s==='listening') {
      if(this.microphone?.sample(true,dt)||e>=TIMES.listening)this.extinguish();
    } else if(s==='extinguishing'&&e>=TIMES.extinguishing)this.enter('blessing');
    else if(s==='blessing'&&e>=TIMES.blessing)this.enter(this.party?'party':this.ready?'revealing':'loading');
    else if(s==='revealing'&&e>=TIMES.revealing)this.enter('white');
    else if(s==='white'&&e>=(this.reduced?1000:TIMES.white))this.enter('pause');
    else if(s==='pause'&&e>=TIMES.pause)this.enter('coloring');
    else if(s==='coloring'&&e>=(this.reduced?1200:TIMES.coloring))this.enter('final');
    this.onFrame(this.state,this.elapsed);
  }
  dispose(){this.generation++;this.microphone?.stop();this.paused=true;}
}

export class BlowDetector {
  constructor(){this.reset();}
  reset(){this.noise=.008;this.sustained=0;this.samples=0;}
  feed(rms,dt,listening){
    if(!listening){this.noise=this.samples++?this.noise*.98+rms*.02:Math.max(.002,rms);this.sustained=0;return false;}
    const threshold=Math.max(.035,this.noise*3.5);
    this.sustained=rms>threshold?this.sustained+Math.min(dt,80):0;
    return this.sustained>=280;
  }
}

export class Microphone {
  constructor({media=globalThis.navigator?.mediaDevices,Context=globalThis.AudioContext||globalThis.webkitAudioContext,onChange=()=>{}}={}) {
    Object.assign(this,{media,Context,onChange,epoch:0,available:false,paused:false,detector:new BlowDetector()});
  }
  async start(){
    this.stop();const epoch=this.epoch;this.detector.reset();
    if(!this.media?.getUserMedia||!this.Context){this.onChange('unavailable');return;}
    let context,stream;
    try{
      context=new this.Context();this.context=context;
      // resume is invoked synchronously from the visitor's click.
      // Attach rejection handling immediately: permission may remain pending
      // long after resume rejects. Do not leave an unhandled promise behind.
      const resumed=Promise.resolve(context.resume()).then(()=>true,()=>{
        if(epoch===this.epoch){this.stop();this.onChange('unavailable');}return false;
      });
      this.onChange('pending');
      stream=await this.media.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());void context.close().catch(()=>{});return;}
      this.stream=stream;const running=await resumed;
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
      if(!running||context.state!=='running')throw new Error('Audio context unavailable');
      this.analyser=context.createAnalyser();this.analyser.fftSize=2048;
      this.source=context.createMediaStreamSource(stream);this.source.connect(this.analyser);
      this.samples=new Float32Array(this.analyser.fftSize);this.available=stream.getAudioTracks().some(t=>t.readyState==='live');
      stream.getAudioTracks().forEach(t=>t.addEventListener?.('ended',()=>{if(epoch===this.epoch){this.available=false;this.onChange('unavailable');}}));
      this.onChange(this.available?'available':'unavailable');
    }catch{
      stream?.getTracks().forEach(t=>t.stop());
      if(epoch===this.epoch){this.stop();this.onChange('unavailable');}
      else void context?.close().catch(()=>{});
    }
  }
  sample(listening,dt){
    if(!this.available||this.paused)return false;
    if(this.context?.state!=='running'){this.available=false;this.onChange('unavailable');return false;}
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum=0;for(const v of this.samples)sum+=v*v;
    return this.detector.feed(Math.sqrt(sum/this.samples.length),dt,listening);
  }
  setPaused(value){this.paused=value;this.detector.sustained=0;}
  stop(){
    this.epoch++;this.available=false;
    this.stream?.getTracks().forEach(t=>t.stop());this.source?.disconnect();
    if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});
    this.stream=null;this.source=null;this.analyser=null;this.context=null;
  }
}

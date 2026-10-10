// One audio element belongs to the whole visit, including every scene/replay.
export class BackgroundMusic {
 constructor({createAudio=()=>document.createElement('audio'),onChange=()=>{}}={}){
  Object.assign(this,{createAudio,onChange,wanted:false,userChoice:false,hidden:false,away:false,stage:'envelope',status:'pending',pending:false});
 }
 configure(config){
  if(!config?.verified||!config.artist||!/^\.\/assets\/music\/[a-zA-Z0-9_-]+\.(mp3|m4a|ogg|wav)$/.test(config.source??''))return false;
  if(this.audio)return false;
  this.title=config.title;this.artist=config.artist;
  this.audio=this.createAudio();this.audio.src=config.source;this.audio.loop=true;this.audio.preload='metadata';this.audio.volume=this.stageVolume();
  this.audio.addEventListener('playing',()=>{if(!this.shouldPlay())this.audio.pause();this.status='ready';this.notify();});
  this.audio.addEventListener('pause',()=>this.notify());
  this.audio.addEventListener('error',()=>{this.status='unavailable';this.notify();});
  this.status='ready';this.sync();return true;
 }
 shouldPlay(){return !!this.audio&&this.wanted&&!this.hidden&&!this.away;}
 stageVolume(){return ({candle:.07,wishing:.035,listening:.025,extinguishing:.04})[this.stage]??.12;}
 gesture(){if(!this.userChoice)this.wanted=true;this.sync();}
 toggle(){if(!this.audio)return;this.userChoice=true;const retry=this.wanted&&this.shouldPlay()&&this.audio.paused&&!this.pending;this.wanted=retry||!this.wanted;if(this.status==='unavailable')this.audio.load();this.sync();}
 setStage(stage){this.stage=stage;if(this.audio)this.audio.volume=this.stageVolume();this.sync();}
 setHidden(hidden){this.hidden=hidden;this.sync();}
 setAway(away){this.away=away;this.sync();}
 sync(){
  if(!this.audio)return;
  if(!this.shouldPlay()){this.audio.pause();this.notify();return;}
  if(!this.audio.paused||this.pending){this.notify();return;}
  this.pending=true;
  // play() must happen inside the actual visitor gesture when a browser needs it.
  let attempt;try{attempt=this.audio.play();}catch{attempt=Promise.reject(new Error('Playback unavailable'));}
  Promise.resolve(attempt).then(()=>{this.pending=false;if(!this.shouldPlay())this.audio.pause();this.status='ready';this.notify();},()=>{this.pending=false;this.status='paused';this.notify();});
  this.notify();
 }
 notify(){this.onChange(this.snapshot());}
 snapshot(){return {status:this.status,configured:!!this.audio,title:this.title??null,artist:this.artist??null,wanted:this.wanted,pending:this.pending,playing:!!this.audio&&!this.audio.paused,held:this.hidden||this.away,volume:this.audio?.volume??0,currentTime:this.audio?.currentTime??0};}
}

export function attachBackgroundMusic(button){
 const music=new BackgroundMusic({createAudio(){const audio=document.createElement('audio');audio.id='background-audio';audio.hidden=true;button.after(audio);return audio;},onChange(state){
  button.hidden=!state.configured;button.dataset.playing=String(state.playing);button.setAttribute('aria-pressed',String(state.wanted));
  const active=state.wanted&&(state.playing||state.pending||state.held),label=state.status==='unavailable'?'重试音乐':active?'静音音乐':'播放音乐';button.setAttribute('aria-label',label);button.title=label;button.querySelector('.music-label').textContent=active?'静音':'音乐';
 }});
 const gesture=e=>{if(e.target.closest?.('#music-toggle'))return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;music.gesture();};
 document.addEventListener('pointerdown',gesture,{capture:true});document.addEventListener('keydown',gesture,{capture:true});music.setHidden(document.hidden);
 button.addEventListener('click',()=>music.toggle());
 fetch('./assets/music.json',{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Music configuration unavailable');return r.json();}).then(config=>music.configure(config)).catch(()=>{});
 return music;
}

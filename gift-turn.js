// This clock advances only while the verified white GLB is visible and rendering.
export const GIFT_TURN = Object.freeze({hold:600, turn:6400, settle:400, reduced:300});
export class GiftTurn {
  constructor(){this.claimed=false;this.state='idle';this.elapsed=0;this.reduced=false;}
  start(reduced=false){this.state='turning';this.elapsed=0;this.reduced=reduced;}
  update(dt){
    if(this.state!=='turning')return false;
    this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,Math.min(Number(dt)||0,250)));
    if(this.elapsed<this.duration)return false;
    this.state=this.claimed?'claimed':'offered';return true;
  }
  get duration(){return this.reduced?GIFT_TURN.reduced:GIFT_TURN.hold+GIFT_TURN.turn+GIFT_TURN.settle;}
  get turnProgress(){return this.reduced?0:Math.max(0,Math.min(1,(this.elapsed-GIFT_TURN.hold)/GIFT_TURN.turn));}
  get angle(){const t=this.turnProgress;return Math.PI*2*t*t*(3-2*t);}
  claim(){if(!['offered','deferred','claimed'].includes(this.state))return false;this.claimed=true;this.state='claimed';return true;}
  defer(){if(this.state!=='offered')return false;this.state='deferred';return true;}
  reopen(){if(this.state==='deferred')this.state='offered';return ['offered','claimed'].includes(this.state);}
  stop(){if(this.state==='turning')this.state='idle';}
  snapshot(){return {state:this.state,claimed:this.claimed,elapsed:this.elapsed,duration:this.duration,turnProgress:this.turnProgress,angle:this.angle,reduced:this.reduced};}
}

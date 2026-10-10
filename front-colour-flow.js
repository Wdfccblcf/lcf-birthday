// This clock advances only through the app's foreground frame loop.
export class FrontColourFlow {
 constructor(){this.reset();}
 reset(){this.elapsed=0;this.duration=4400;this.state='white';this.progress=0;this.reduced=false;}
 start(reduced=false){if(this.state!=='white')return false;this.reduced=reduced;this.duration=reduced?300:4400;this.state='colouring';return true;}
 update(dt){if(this.state!=='colouring')return;this.elapsed+=Math.max(0,Math.min(250,Number(dt)||0));this.progress=Math.min(1,this.elapsed/this.duration);if(this.progress===1)this.state='coloured';}
 snapshot(){return {state:this.state,elapsed:this.elapsed,duration:this.duration,progress:this.progress,reduced:this.reduced};}
}

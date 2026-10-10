// Foreground-time paint flow shared by the real model and its accessible tray.
export const PIGMENTS=Object.freeze([
 {name:'粉色',color:'#f797ae'},
 {name:'浅蓝',color:'#9bddf1'},
 {name:'浅绿',color:'#d4e19a'},
 {name:'暖金',color:'#efb976'},
 {name:'奶油',color:'#fff2e9'},
 {name:'莓红',color:'#72324e'}
]);
export class PaintFlow{
 constructor(){this.values=new Float32Array(PIGMENTS.length);this.reset();}
 reset(){this.values.fill(0);this.active=-1;this.elapsed=0;this.phase=0;this.reduced=false;this.previous=0;}
 start(index,reduced=false){if(!Number.isInteger(index)||index<0||index>=this.values.length||this.active>=0)return false;this.active=index;this.elapsed=0;this.phase=0;this.reduced=reduced;this.previous=this.values[index];return true;}
 update(dt){if(this.active<0)return;this.elapsed+=Math.max(0,Math.min(dt,250));this.phase=Math.min(1,this.elapsed/(this.reduced?1200:4600));this.values[this.active]=Math.max(this.previous,this.phase);if(this.phase===1){this.values[this.active]=1;this.active=-1;}}
 snapshot(){return{active:this.active,elapsed:this.elapsed,phase:this.phase,values:[...this.values],completed:[...this.values].filter(v=>v===1).length,reduced:this.reduced};}
}

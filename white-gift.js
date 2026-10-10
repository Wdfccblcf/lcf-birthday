import * as THREE from 'three';
import {Figurine} from './figurine.js?v=195483fbf2b9';
import {GiftTurn} from './gift-turn.js?v=f45908682ed1';

export class WhiteGift extends Figurine {
  constructor(host,{onOffer=()=>{},onChange=()=>{},...options}={}){
    super(host,{...options,whiteOnly:true});this.gift=new GiftTurn();this.onOffer=onOffer;this.onChange=onChange;
    this.renderer.domElement.setAttribute('aria-label','铃铛白模三维展示');
    this.renderer.domElement.tabIndex=-1;
    this.renderer.domElement.style.pointerEvents='none';
    try{this.gift.claimed=localStorage.getItem('lcf-bell-gift-claim-v1')==='claimed';}catch{}
  }
  async load(){
    await super.load();
    if(!this.baseCap){
      // Measured native base bounds and original top at 9.72 mm are recorded in
      // work/front-claim-20261010/base-inspection.json. This wafer fills the
      // rectangular display recesses without rewriting any manufacturing mesh.
      const nativeBase=this.root.children.find(o=>o.isMesh);
      const geometry=new THREE.CircleGeometry(43.0,128);geometry.rotateX(-Math.PI/2);
      const material=nativeBase.material.clone();
      this.baseCap=new THREE.Mesh(geometry,material);this.baseCap.name='smooth-display-base-cap';
      this.baseCap.position.set(-3.1888,9.90,-.00018);nativeBase.add(this.baseCap);
      this.baseCap.updateMatrixWorld(true);
      this.renderer.compile(this.scene,this.camera);
    }
  }
  clearModel(){this.baseCap=null;super.clearModel();}
  startTurn(reduced=false){
    if(!this.ready||this.lost)return false;
    super.reset();this.setRotation(0);this.auto=false;this.setInteractive(false);
    this.gift.start(reduced);this.onChange();return true;
  }
  leave(){this.gift.stop();this.onChange();}
  claim(){if(!this.gift.claim())return false;try{localStorage.setItem('lcf-bell-gift-claim-v1','claimed');}catch{}this.onChange();return true;}
  defer(){if(this.gift.defer())this.onChange();}
  reopen(){return this.gift.reopen();}
  frame(dt){
    if(!this.ready||!this.visible||this.lost)return;
    const completed=this.gift.update(dt);this.setRotation(this.gift.angle);
    super.frame(dt);
    if(completed){this.onChange();this.onOffer();}
  }
  snapshot(){return {...super.snapshot(),kind:'white-gift-360',gift:this.gift.snapshot(),smoothBase:!!this.baseCap};}
}

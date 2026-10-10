import * as THREE from 'three';
import {ForestGate} from './forest-portal.js?v=c9190626eb60';
export class MemoryCorridor {
 constructor(host,{catalog,onError=()=>{},onStep=()=>{},onDoorRequest=()=>{},onGateReady=()=>{},reduced=()=>false}={}){
  const layout=catalog.layout();
  Object.assign(this,{host,catalog,onError,onStep,onDoorRequest,reduced,step:0,visible:false,ready:false,stops:layout.stops});
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<760?1.3:1.6));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  const canvas=this.renderer.domElement;canvas.id='corridor-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','生日回忆走廊通道留空方向键移动到达哪段回忆哪处灯光才亮起');host.append(canvas);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x100e0c);this.scene.fog=new THREE.FogExp2(0x100e0c,.038);
  this.camera=new THREE.PerspectiveCamera(innerWidth<760?61:52,1,.05,Math.max(70,layout.length+20));this.look=new THREE.Vector3(...this.stops[0].target);this.camera.position.set(...this.stops[0].position);
  this.destination=new THREE.Vector3(...this.stops[0].position);this.looking=new THREE.Vector3(...this.stops[0].target);
  // Indirect light keeps the empty passage readable; each stop owns its lamp.
  this.scene.add(new THREE.HemisphereLight(0xfff5db,0x2c2926,1.35));
  const soft=new THREE.DirectionalLight(0xffffff,1.5);soft.position.set(0,3,4);this.scene.add(soft);
  this.owned=[];this.zones=[];this.pictures=[];
  const material=(color,roughness=.8,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});this.owned.push(m);return m;};
  const wall=material(0x27221e),floor=material(0x302b25,.52),gold=material(0xb08a4d,.4,.5),black=material(0x151311);
  const box=(size,position,mat)=>{const g=new THREE.BoxGeometry(...size);this.owned.push(g);const mesh=new THREE.Mesh(g,mat);mesh.position.set(...position);this.scene.add(mesh);return mesh;};
  box([4.5,.08,layout.length],[0,-.05,layout.centerZ],floor);box([.12,3.3,layout.length],[-2.22,1.6,layout.centerZ],wall);box([.12,3.3,layout.length],[2.22,1.6,layout.centerZ],wall);box([4.5,.08,layout.length],[0,3.24,layout.centerZ],black);
  const guide=new THREE.MeshBasicMaterial({color:0xe6c68a});this.owned.push(guide);
  this.pathLamps=[];
  for(let z=2;z>layout.doorZ;z-=2.4){box([.022,.01,1.7],[-2.08,.013,z],guide);box([.022,.01,1.7],[2.08,.013,z],guide);const ink=new THREE.MeshBasicMaterial({color:0xe6c68a});this.owned.push(ink);box([1.4,.015,.035],[0,3.14,z],ink);this.pathLamps.push({z,ink});}
  const seams=material(0x4a4136);for(let z=2;z>layout.doorZ;z-=1.2)box([4.28,.006,.013],[0,.005,z],seams);
  const textures=new THREE.TextureLoader();
  const picture=(url,w,h,pos,rotation,zone,crop)=>{
   let p;const geometry=new THREE.PlaneGeometry(w,h),texture=textures.load(url,()=>{if(this.disposed)return;texture.colorSpace=THREE.SRGBColorSpace;let aspect=texture.image.width/texture.image.height;if(crop){texture.offset.set(crop.x,crop.y);texture.repeat.set(crop.w,crop.h);aspect*=crop.w/crop.h}const target=w/h;if(aspect>target)p.scale.y=target/aspect;else p.scale.x=aspect/target;},undefined,()=>{if(!this.disposed)onError('走廊里的图片暂时没有加载完成请重试');});this.owned.push(geometry,texture);
   const m=new THREE.MeshBasicMaterial({map:texture,transparent:!!crop,color:new THREE.Color().setScalar(.16),toneMapped:false});this.owned.push(m);this.pictures.push({material:m,zone});
   p=new THREE.Mesh(geometry,m);p.position.set(...pos);p.rotation.y=rotation;this.scene.add(p);
  };
  // Recessed wall frames. Nothing sits or stands in the walking area.
  for(const exhibit of layout.walls){const {side,z,step,memory}=exhibit;
   if(memory.id==='snowflake'){
    // Follow the printed card's portrait proportions, without a black matte.
    const h=1.50,w=h*920/1370;
    box([.07,h+.035,w+.035],[side*2.146,1.6,z],gold);
    picture(memory.image,w,h,[side*2.075,1.6,z],-side*Math.PI/2,step,{x:52/1024,y:72/1536,w:920/1024,h:1370/1536});
    continue;
   }
   const w=1.32,h=memory.kind==='quiz'?.88:1.32;
   box([.07,1.54,memory.kind==='figurine'?1.75:1.54],[side*2.146,1.6,z],gold);box([.065,1.46,memory.kind==='figurine'?1.67:1.46],[side*2.119,1.6,z],black);picture(memory.image,w,h,[side*2.075,1.6,z],-side*Math.PI/2,step);
  }
  const doorZ=layout.doorZ;
  this.gate=new ForestGate(this.scene,{z:doorZ,wall,owned:this.owned,reduced,onError,onReady:onGateReady});this.doorGlow=this.gate.glow;
  this.endLight=new THREE.PointLight(0xffd49d,6,7,2);this.endLight.position.set(0,2,doorZ+1.2);this.scene.add(this.endLight);
  const lamps=layout.walls.map(m=>[m.step,m.side*1.38,m.z,[m.side*2.08,1.55,m.z]]);lamps.push([catalog.lastStep,0,doorZ+1.4,[0,1.4,doorZ]]);
  for(const [step,x,z,target]of lamps){
   const wash=new THREE.PointLight(0xffd49b,2.2,7.5,2);wash.position.set(0,2.78,z);this.scene.add(wash);
   const light=new THREE.SpotLight(0xffe5b5,.32,6.5,Math.PI*.30,.8,2);light.position.set(x,2.99,z);light.target.position.set(...target);this.scene.add(light,light.target);
   const lamp=new THREE.MeshBasicMaterial({color:0x4b4234,toneMapped:false});this.owned.push(lamp);box([step===catalog.lastStep?1.2:.68,.015,.028],[x,3.09,z],lamp);
   this.zones.push({step,light,wash,lamp,position:new THREE.Vector3(...this.stops[step].position),level:0,nearness:0,distance:0});
  }
  const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);this.renderer.setSize(w,h,false);this.viewportWidth=w;this.camera.aspect=w/h;this.camera.fov=this.framingFov();this.camera.updateProjectionMatrix();};this.observer=new ResizeObserver(resize);this.observer.observe(host);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onError('走廊的图形显示中断了请重新打开');});canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;onError(null);});
  canvas.addEventListener('keydown',e=>{if(!this.visible)return;if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home'].includes(e.key)){e.preventDefault();this.go(e.key==='Home'?0:this.step+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}else if(e.key==='Enter'&&this.step===catalog.lastStep){e.preventDefault();this.onDoorRequest();}});
  canvas.addEventListener('wheel',e=>{if(!this.visible||Math.abs(e.deltaY)<12)return;e.preventDefault();const now=performance.now();if(now-(this.lastWheel||0)<900)return;this.lastWheel=now;this.go(this.step+Math.sign(e.deltaY));},{passive:false});
  let drag;canvas.addEventListener('pointerdown',e=>{if(!this.visible||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  const release=e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(e.type==='pointerup'){if(Math.abs(e.clientX-d.x)>45)this.go(this.step+(e.clientX<d.x?1:-1));else if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<8&&this.step===catalog.lastStep&&this.gate.hit(this.camera,canvas,e.clientX,e.clientY))this.onDoorRequest();}};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  this.ready=true;this.camera.lookAt(this.look);this.onStep(0);
  const passage=new THREE.Box3(new THREE.Vector3(-1.8,.05,doorZ+.15),new THREE.Vector3(1.8,2.8,3.5));
  this.scene.updateMatrixWorld(true);this.passageObjects=0;this.scene.traverse(o=>{if(o.isMesh&&new THREE.Box3().setFromObject(o).intersectsBox(passage))this.passageObjects++;});
 }
 go(step){const next=THREE.MathUtils.clamp(step,0,this.catalog.lastStep);if(next===this.step)return;this.resetGate();this.step=next;this.destination.set(...this.stops[next].position);this.looking.set(...this.stops[next].target);this.onStep(next);}
 openDoor(onComplete){if(!this.visible||this.lost||this.step!==this.catalog.lastStep)return false;return this.gate.open(onComplete);}
 resetGate(){this.gate.reset();}
 framingFov(){
  if(this.viewportWidth>=760)return 52;
  if(this.step!==this.catalog.lastStep||this.camera.aspect>=1)return 61;
  // Keep the whole forest entrance in portrait without backing into a memory frame.
  const horizontal=THREE.MathUtils.degToRad(52);
  return THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(horizontal/2)/this.camera.aspect));
 }
 frame(dt){
  if(!this.visible||this.lost)return;
  this.gate.frame(dt);if(!this.visible)return;
  const destination=this.destination.clone();destination.z-=this.gate.walk;
  const a=this.reduced()?1:1-Math.exp(-dt/(this.gate.state==='opening'?110:430));this.camera.position.lerp(destination,a);this.look.lerp(this.looking,a);this.camera.lookAt(this.look);
  const fov=THREE.MathUtils.lerp(this.camera.fov,this.framingFov()*this.gate.zoom,a);if(Math.abs(fov-this.camera.fov)>.001){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  for(const zone of this.zones){
   zone.distance=this.camera.position.distanceTo(zone.position);zone.nearness=1-THREE.MathUtils.smoothstep(zone.distance,.35,7);
   const active=zone.step===this.step?1-THREE.MathUtils.smoothstep(zone.distance,.3,1.7):0;
   zone.level=THREE.MathUtils.lerp(zone.level,active,this.reduced()?1:1-Math.exp(-dt/510));zone.light.intensity=.16+zone.level*12;zone.wash.intensity=.5+zone.nearness*3.5;
   zone.lamp.color.set(0xc1a977).multiplyScalar(.045+zone.nearness*.13+zone.level*.75);
  }
  for(const lamp of this.pathLamps){const distance=Math.abs(this.camera.position.z-lamp.z),near=1-THREE.MathUtils.smoothstep(distance,1.2,9);lamp.ink.color.set(0xe6c68a).multiplyScalar(.55+near*.45);}
  for(const p of this.pictures){const zone=this.zones.find(z=>z.step===p.zone);p.material.color.setScalar(.65+zone.nearness*.20+zone.level*.15);}
  const end=this.zones.at(-1);this.doorGlow.color.set(0xe6c68a).multiplyScalar(.55+end.nearness*.25+end.level*.20);this.endLight.intensity=6+end.nearness*9;
  this.renderer.render(this.scene,this.camera);
 }
 snapshot(){return {step:this.step,memoryId:this.catalog.at(this.step)?.id??'entry',stopCount:this.stops.length,ready:this.ready,lost:!!this.lost,passageObjects:this.passageObjects,gate:this.gate.snapshot(),activeLights:this.zones.map(z=>({step:z.step,id:this.catalog.at(z.step).id,level:z.level,intensity:z.light.intensity,distance:z.distance,nearness:z.nearness,ambientIntensity:z.wash.intensity})),triangles:this.renderer.info.render.triangles,camera:this.camera.position.toArray(),fov:this.camera.fov,aspect:this.camera.aspect};}
 dispose(){this.disposed=true;this.gate.dispose();this.observer.disconnect();this.owned.forEach(o=>o.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}

import * as THREE from 'three';

// The reference-derived forest frame stays in the end wall
// An opaque moving veil hides the birthday room until the visitor crosses it
export class ForestGate {
 constructor(scene,{z,wall,owned,reduced,onError=()=>{},onReady=()=>{}}){
  Object.assign(this,{owned,reduced,elapsed:0,state:'closed',progress:0,walk:0,flash:0,zoom:1,clock:0,ready:false,frameReady:false,groundReady:false});
  this.root=new THREE.Group();this.root.position.z=z;scene.add(this.root);
  const own=resource=>{owned.push(resource);return resource;};
  const add=(geometry,material,position)=>{const mesh=new THREE.Mesh(own(geometry),material);mesh.position.set(...position);this.root.add(mesh);return mesh;};
  const checkReady=()=>{if(!this.disposed&&!this.ready&&this.frameReady&&this.groundReady){this.ready=true;onReady();}};
  const opening=new THREE.Shape();opening.moveTo(-1.02,.005);opening.lineTo(1.02,.005);opening.lineTo(1.02,2.09);opening.quadraticCurveTo(.98,2.95,0,3.04);opening.quadraticCurveTo(-.98,2.95,-1.02,2.09);opening.closePath();
  const surround=new THREE.Shape();surround.moveTo(-2.2,0);surround.lineTo(2.2,0);surround.lineTo(2.2,3.3);surround.lineTo(-2.2,3.3);surround.closePath();
  const hole=new THREE.Path(opening.getPoints(32));surround.holes.push(hole);
  add(new THREE.ExtrudeGeometry(surround,{depth:.08,bevelEnabled:false,curveSegments:24}),wall,[0,0,-.18]);
  this.glow=own(new THREE.MeshBasicMaterial({color:0xe6c68a,toneMapped:false}));
  this.veilMaterial=own(new THREE.ShaderMaterial({
   uniforms:{uTime:{value:0},uSurge:{value:0}},toneMapped:false,
   vertexShader:'varying vec2 vPoint; void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`
    uniform float uTime; uniform float uSurge; varying vec2 vPoint;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float mist(vec2 p){float n=0.0,a=.52;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+vec2(7.2,3.1);a*=.5;}return n;}
    void main(){
     vec2 uv=vec2((vPoint.x+1.02)/2.04,vPoint.y/3.04);
     float clouds=mist(uv*4.1+vec2(uTime*.018,-uTime*.037));
     float second=mist(uv*6.0+vec2(-uTime*.022,uTime*.014));
     float center=1.0-smoothstep(.12,.78,length((uv-vec2(.5,.5))*vec2(1.2,.85)));
     vec3 warm=mix(vec3(.18,.12,.05),vec3(.82,.69,.43),smoothstep(.23,.73,clouds));
     warm=mix(warm,vec3(.96,.87,.67),second*.28+center*.14);
     warm=mix(warm,vec3(1.0,.97,.89),uSurge);
     gl_FragColor=vec4(warm,1.0);
     #include <colorspace_fragment>
    }`
  }));
  this.veil=add(new THREE.ShapeGeometry(opening,36),this.veilMaterial,[0,0,-.08]);this.veil.renderOrder=1;
  const frameTexture=own(new THREE.TextureLoader().load('./assets/forest-portal-frame-v1.png',()=>{if(this.disposed)return;frameTexture.colorSpace=THREE.SRGBColorSpace;this.frameReady=true;checkReady();},undefined,()=>{if(!this.disposed)onError('森林入口暂时没有加载完成请重新打开');}));
  const frameMaterial=own(new THREE.MeshBasicMaterial({map:frameTexture,transparent:true,alphaTest:.015,depthWrite:false,toneMapped:false}));
  this.frameMesh=add(new THREE.PlaneGeometry(3.5,3.32),frameMaterial,[0,1.66,.012]);this.frameMesh.renderOrder=2;
  const spill=new THREE.PointLight(0xffd28c,5,5,2);spill.position.set(0,1.2,.28);this.root.add(spill);this.spill=spill;
  // A few physical specks hover at the threshold without filling the passage
  const positions=[];for(let i=0;i<16;i++)positions.push(Math.sin(i*2.39)*.83,.24+(i*.193)%2.5,-.035);
  const dustGeometry=own(new THREE.BufferGeometry());dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const dustMaterial=own(new THREE.PointsMaterial({color:0xffe6a4,size:.018,transparent:true,opacity:.45,toneMapped:false,depthWrite:false}));
  this.dust=new THREE.Points(dustGeometry,dustMaterial);this.root.add(this.dust);
  // A thin forest-floor decal joins the photographed tree roots to the room floor
  // Five worn stones are partly buried in earth and moss rather than raised tiles
  const groundTexture=own(new THREE.TextureLoader().load('./assets/elven-doorstep-v1.png',()=>{if(this.disposed)return;groundTexture.colorSpace=THREE.SRGBColorSpace;this.groundReady=true;checkReady();},undefined,()=>{if(!this.disposed)onError('门前的小路暂时没有加载完成请重新打开');}));
  groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.anisotropy=8;
  const groundMaterial=own(new THREE.MeshStandardMaterial({map:groundTexture,transparent:true,alphaTest:.012,depthWrite:false,roughness:1,emissive:0x596048,emissiveMap:groundTexture,emissiveIntensity:.16}));
  this.doorstep=add(new THREE.PlaneGeometry(3.8,1.65),groundMaterial,[0,-.006,.58]);this.doorstep.rotation.x=-Math.PI/2;

 }
 open(onComplete){if(this.state!=='closed'||!this.ready)return false;this.state='opening';this.elapsed=0;this.onComplete=onComplete;return true;}
 reset(){this.state='closed';this.elapsed=this.progress=this.walk=this.flash=0;this.zoom=1;this.onComplete=null;if(this.veilMaterial)this.veilMaterial.uniforms.uSurge.value=0;if(this.spill)this.spill.intensity=5;}
 frame(dt){
  if(!this.reduced()&&!navigator.connection?.saveData){this.clock+=Math.max(0,dt)/1000;this.veilMaterial.uniforms.uTime.value=this.clock;this.dust.rotation.z=Math.sin(this.clock*.17)*.023;}
  if(this.state!=='opening')return;
  this.elapsed+=Math.max(0,dt);const duration=this.reduced()?240:2200;
  this.progress=this.reduced()?Math.min(1,this.elapsed/duration):THREE.MathUtils.smoothstep(this.elapsed,120,1900);
  this.walk=this.reduced()?0:this.progress*2.75;this.zoom=this.reduced()?1:1-this.progress*.20;
  this.flash=this.reduced()?THREE.MathUtils.smoothstep(this.elapsed,40,150):THREE.MathUtils.smoothstep(this.elapsed,1200,1930);
  this.veilMaterial.uniforms.uSurge.value=THREE.MathUtils.smoothstep(this.progress,.08,.83);this.spill.intensity=5+this.progress*13;
  if(this.elapsed>=duration){this.state='open';const complete=this.onComplete;this.onComplete=null;complete?.();}
 }
 hit(camera,canvas,x,y){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);return ray.intersectObjects([this.veil,this.frameMesh]).length>0;}
 snapshot(){return {kind:'forest-portal',sign:'LCF18岁生日快乐',state:this.state,progress:this.progress,elapsed:this.elapsed,ready:this.ready,opaque:true,walk:this.walk,zoom:this.zoom,flash:this.flash};}
 dispose(){this.disposed=true;this.onComplete=null;}
}

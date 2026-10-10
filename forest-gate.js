import * as THREE from 'three';

// The gate belongs to the last catalog stop and stays at the end wall
// Opening is driven by the corridor's foreground clock rather than a timer
export class ForestGate {
 constructor(scene,{z,wall,owned,reduced}){
  Object.assign(this,{owned,reduced,elapsed:0,state:'closed',progress:0,walk:0});
  this.root=new THREE.Group();this.root.position.z=z;scene.add(this.root);
  const own=resource=>{owned.push(resource);return resource;};
  const add=(geometry,material,position,parent=this.root)=>{
   const mesh=new THREE.Mesh(own(geometry),material);mesh.position.set(...position);parent.add(mesh);return mesh;
  };
  const woodTexture=()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
   const c=canvas.getContext('2d');c.fillStyle='#806349';c.fillRect(0,0,768,768);
   for(let i=0;i<290;i++){
    c.strokeStyle=i%4?'#3e301825':'#eed2a52b';c.lineWidth=i%7===0?2:1;c.beginPath();
    for(let y=0;y<=768;y+=12){const x=(i*37.37)%768+Math.sin(y*.012+i*.7)*(2+i%4)+Math.sin(y*.029+i)*.9;y?c.lineTo(x,y):c.moveTo(x,y);}
    c.stroke();
   }
   const texture=own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
  };
  const grain=woodTexture();
  const wood=own(new THREE.MeshStandardMaterial({map:grain,color:0xa7aa91,roughness:.92}));
  const bark=own(new THREE.MeshStandardMaterial({map:grain,color:0x938c79,roughness:1}));
  const brass=own(new THREE.MeshStandardMaterial({color:0xb49255,roughness:.42,metalness:.7}));
  const surround=new THREE.Shape();surround.moveTo(-2.2,0);surround.lineTo(2.2,0);surround.lineTo(2.2,3.3);surround.lineTo(-2.2,3.3);surround.closePath();
  const hole=new THREE.Path();hole.moveTo(-.99,.012);hole.lineTo(-.99,2.07);hole.quadraticCurveTo(-.87,2.8,0,2.85);hole.quadraticCurveTo(.87,2.8,.99,2.07);hole.lineTo(.99,.012);hole.closePath();surround.holes.push(hole);
  add(new THREE.ExtrudeGeometry(surround,{depth:.08,bevelEnabled:false,curveSegments:24}),wall,[0,0,-.18]);
  this.leaves=[];
  for(const side of [-1,1]){
   const pivot=new THREE.Group();pivot.position.set(side*.985,.015,-.045);this.root.add(pivot);this.leaves.push(pivot);
   const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(-side*.977,0);shape.lineTo(-side*.977,2.76);shape.quadraticCurveTo(-side*.16,2.70,0,2.04);shape.closePath();
   add(new THREE.ExtrudeGeometry(shape,{depth:.055,steps:1,bevelEnabled:true,bevelThickness:.007,bevelSize:.006,bevelSegments:2,curveSegments:24}),wood,[0,0,-.023],pivot);
   const grooves=own(new THREE.MeshStandardMaterial({color:0x3b2e22,roughness:1}));
   for(let i=1;i<6;i++){
    const u=i/6,height=2.04+.72*Math.sqrt(1-(1-u)**2);
    add(new THREE.BoxGeometry(.008,height,.007),grooves,[-side*u*.977,height/2,.037],pivot);
   }
   for(const y of [.38,1.78]){
    add(new THREE.BoxGeometry(.91,.075,.022),wood,[-side*.488,y,.047],pivot);
    for(const x of [.13,.82])add(new THREE.SphereGeometry(.013,8,6),brass,[-side*x,y,.064],pivot);
   }
   const ring=add(new THREE.TorusGeometry(.072,.013,7,22),brass,[-side*.81,1.12,.11],pivot);ring.rotation.x=.12;
   add(new THREE.SphereGeometry(.035,12,8),brass,[-side*.81,1.2,.086],pivot);
  }
  const branch=(points,radius,tip=.008)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const count=36,sides=10,frames=curve.computeFrenetFrames(count,false),positions=[],uvs=[],indices=[];
   for(let i=0;i<=count;i++){
    const t=i/count,p=curve.getPointAt(t),r=tip+(radius-tip)*Math.pow(1-t,.7);
    for(let j=0;j<=sides;j++){
     const angle=j/sides*Math.PI*2,flute=1+.06*Math.sin(j*3+i*.27);
     const v=p.clone().addScaledVector(frames.normals[i],Math.cos(angle)*r*flute).addScaledVector(frames.binormals[i],Math.sin(angle)*r*flute);
     positions.push(...v.toArray());uvs.push(j/sides,t*4);
     if(i<count&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,bark,[0,0,0]);
  };
  const greens=[0x4c6345,0x647851,0x344b36].map(color=>own(new THREE.MeshStandardMaterial({color,roughness:.83,side:THREE.DoubleSide})));
  const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.07,.08,-.07,.17,0,.24);leafShape.bezierCurveTo(.08,.16,.06,.065,0,0);
  const leafGeometry=own(new THREE.ShapeGeometry(leafShape,8));
  const leaf=(x,y,angle,size,index)=>{const mesh=new THREE.Mesh(leafGeometry,greens[index%3]);mesh.position.set(x,y,.065);mesh.rotation.z=angle;mesh.rotation.y=Math.sin(index)*.15;mesh.scale.setScalar(size);this.root.add(mesh);};
  for(const side of [-1,1]){
   branch([[side*1.48,.02,-.07],[side*1.27,.69,-.06],[side*1.13,1.46,-.04],[side*1.08,2.2,-.025],[side*.74,2.8,-.03],[side*.11,3.01,-.055]],.17,.037);
   branch([[side*2.2,.22,-.11],[side*1.83,.21,-.07],[side*1.39,.38,-.06],[side*1.22,.91,-.05]],.075,.012);
   branch([[side*2.2,1.53,-.09],[side*1.76,1.77,-.045],[side*1.2,2.16,-.025],[side*.94,2.54,-.01]],.087,.018);
   branch([[side*1.17,1.66,-.04],[side*1.48,2.2,-.035],[side*1.6,2.61,-.025],[side*1.47,2.96,-.02]],.065,.008);
   branch([[side*.78,2.75,-.03],[side*.48,3.12,-.05],[side*.02,3.2,-.06]],.041,.005);
   for(let i=0;i<22;i++){
    const angle=i*.79,x=side*(.6+(i%6)*.19),y=2.56+Math.sin(i*2.17)*.35;
    branch([[side*Math.min(1.1,.4+(3.05-y)*1.3),y-.09,-.035],[(x+side*1.05)/2,y-.06,.006],[x,y,.06]],.012,.002);
    leaf(x,y,side*(angle%2.2-.9),.53+(i%4)*.12,i);
   }
   for(let i=0;i<7;i++)leaf(side*(1.4+Math.sin(i*1.73)*.22),1.71+i*.1,side*(.5+i*.6),.44,i);
  }
  const signCanvas=document.createElement('canvas');signCanvas.width=2048;signCanvas.height=400;const s=signCanvas.getContext('2d');
  s.fillStyle='#5b4230';s.fillRect(0,0,2048,400);
  for(let i=0;i<70;i++){s.strokeStyle=i%3?'#efd8a816':'#190d0928';s.lineWidth=i%5===0?3:1;s.beginPath();for(let x=0;x<=2048;x+=24){const y=i*5.8+Math.sin(x*.01+i)*3;x?s.lineTo(x,y):s.moveTo(x,y);}s.stroke();}
  s.font='180px "Songti SC", "SimSun", serif';s.textAlign='center';s.textBaseline='middle';s.fillStyle='#fae5b7';s.shadowColor='#20140d';s.shadowBlur=3;s.shadowOffsetY=4;s.fillText('LCF18岁生日快乐',1024,208,1880);
  const signTexture=own(new THREE.CanvasTexture(signCanvas));signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMaterial=own(new THREE.MeshBasicMaterial({map:signTexture,toneMapped:false}));
  add(new THREE.BoxGeometry(2.02,.395,.022),wood,[0,2.6,.063]);this.sign=add(new THREE.PlaneGeometry(2.01,.385),signMaterial,[0,2.6,.079]);
  const cord=own(new THREE.MeshStandardMaterial({color:0x9b875e,roughness:1}));
  for(const x of [-.7,.7])add(new THREE.CylinderGeometry(.007,.007,.27,6),cord,[x,2.925,.064]);
  this.glow=own(new THREE.MeshBasicMaterial({color:0xe6c68a,toneMapped:false}));
  for(const side of [-1,1]){const bulb=add(new THREE.SphereGeometry(.027,12,8),this.glow,[side*1.05,2.27,.077]);bulb.scale.y=1.3;}
  // A shallow illuminated passage behind the wall is revealed by the hinged leaves
  const inner=own(new THREE.MeshStandardMaterial({color:0x493b2d,roughness:.94}));
  add(new THREE.BoxGeometry(2,.035,4),inner,[0,-.008,-2.05]);
  for(const side of [-1,1])add(new THREE.BoxGeometry(.045,2.9,4),inner,[side*1.015,1.45,-2.05]);
  const lightCanvas=document.createElement('canvas');lightCanvas.width=256;lightCanvas.height=512;const l=lightCanvas.getContext('2d'),gradient=l.createRadialGradient(128,195,20,128,230,325);gradient.addColorStop(0,'#e5c38a');gradient.addColorStop(.5,'#947249');gradient.addColorStop(1,'#302519');l.fillStyle=gradient;l.fillRect(0,0,256,512);
  const lightTexture=own(new THREE.CanvasTexture(lightCanvas));lightTexture.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(1.98,2.85),own(new THREE.MeshBasicMaterial({map:lightTexture,toneMapped:false})),[0,1.43,-4.05]);
  const light=new THREE.PointLight(0xffd6a0,3.5,6,2);light.position.set(0,1.9,-2.3);this.root.add(light);
 }
 open(onComplete){if(this.state!=='closed')return false;this.state='opening';this.elapsed=0;this.onComplete=onComplete;return true;}
 reset(){this.state='closed';this.elapsed=this.progress=this.walk=0;this.onComplete=null;this.leaves.forEach(leaf=>leaf.rotation.y=0);}
 frame(dt){
  if(this.state!=='opening')return;
  this.elapsed+=Math.max(0,dt);const duration=this.reduced()?240:2600;
  const t=Math.min(1,this.elapsed/(this.reduced()?180:1600));this.progress=t*t*(3-2*t);
  this.leaves.forEach((leaf,i)=>leaf.rotation.y=(i===0?1:-1)*this.progress*1.43);
  this.walk=this.reduced()?0:THREE.MathUtils.smoothstep(this.elapsed,2050,2600)*.85;
  if(this.elapsed>=duration){this.state='open';const complete=this.onComplete;this.onComplete=null;complete?.();}
 }
 hit(camera,canvas,x,y){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);return ray.intersectObjects(this.leaves,true).length>0;}
 snapshot(){return {kind:'forest',sign:'LCF18岁生日快乐',state:this.state,progress:this.progress,elapsed:this.elapsed};}
}

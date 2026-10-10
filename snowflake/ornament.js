import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createOrnamentPhysics } from './physics.js?v=11-display-anchor';
import { lowerChainCurve,linkSamples } from './chain-layout.js?v=9-connected-chain';

const labels={TopMount:'上方挂环',OuterRing:'花纹外环',MiddleRing:'中圈银环',InnerRing:'内圈银环',SnowflakeCore:'中间的雪花',BlueBranch:'蓝珠长链',CrystalBranch1:'透明吊坠',CrystalBranch2:'透明吊坠',CrystalBranch3:'透明吊坠',CrystalBranch4:'透明吊坠'};
const logicalName=name=>name.replace(/(?:Chain|Payload)$/,'');
const qFrom=r=>new THREE.Quaternion(r.x,r.y,r.z,r.w);
const vFrom=r=>new THREE.Vector3(r.x,r.y,r.z);
const assetURL=new URL('./assets/',import.meta.url);

/** A standalone controller. A host may mount this in a memory panel, then call
 * pause/dispose when the panel is hidden or removed. No document-wide listeners. */
export async function mountSnowflake(host,{onHint=()=>{},onProgress=()=>{}}={}){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.transmissionResolutionScale=.5;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','三维吊饰。拖动银环或吊坠；方向键拨动，空格轻拨，Home 恢复。');
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  // Transmission samples an opaque render buffer. A local backdrop is required
  // for the clear drops to refract it instead of turning white over alpha.
  const backgroundCanvas=document.createElement('canvas');backgroundCanvas.width=512;backgroundCanvas.height=512;
  const backgroundTexture=new THREE.CanvasTexture(backgroundCanvas);backgroundTexture.colorSpace=THREE.SRGBColorSpace;
  function backdrop(dark){const ctx=backgroundCanvas.getContext('2d');ctx.fillStyle=dark?'#101c1a':'#e2e4dc';ctx.fillRect(0,0,512,512);const glow=ctx.createRadialGradient(266,225,0,266,225,340);glow.addColorStop(0,dark?'#304e43':'#f5f6e9');glow.addColorStop(.58,dark?'#1d332c':'#dfe5de');glow.addColorStop(1,dark?'#101c1a':'#c6cfca');ctx.fillStyle=glow;ctx.fillRect(0,0,512,512);if(!dark){for(const x of [148,362]){const shadow=ctx.createLinearGradient(x-24,0,x+24,0);shadow.addColorStop(0,'rgba(71,90,83,0)');shadow.addColorStop(.5,'rgba(71,90,83,.20)');shadow.addColorStop(1,'rgba(71,90,83,0)');ctx.fillStyle=shadow;ctx.fillRect(x-24,0,48,512)}}backgroundTexture.needsUpdate=true}
  backdrop(false);scene.background=backgroundTexture;
  const camera=new THREE.PerspectiveCamera(34,1,.05,100);camera.position.set(1.45,.75,11.4);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.32,0);controls.enableDamping=true;controls.dampingFactor=.08;
  controls.enablePan=false;controls.enabled=false;controls.minDistance=3.3;controls.maxDistance=22;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  // A window and darker side cards give real metal and cut glass legible
  // reflections; a uniformly bright room washed the first model out.
  for(const [x,y,z,color,w,h] of [[-3,1.7,2,0xffffff,2.2,4.2],[3.2,1.2,1.4,0x27312f,2.6,4.8],[1,2.6,-3,0xd5e5ed,2.5,2.5]]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));card.position.set(x,y,z);card.lookAt(0,0,0);room.add(card);
  }
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const hemi=new THREE.HemisphereLight(0xf4f5ed,0x777b70,.65);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xfffaf0,1.5);key.position.set(-3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd4e5f0,.65);fill.position.set(3,1,-2);scene.add(fill);
  const assetGroup=new THREE.Group();scene.add(assetGroup);
  let manifest,physics,gltf,resizeObserver,frame=0,lastTime=0,accumulator=0,paused=false,disposed=false,mode='play',detail=false,drag=null,selected='MiddleRing';
  const resources=new Set(),parts=new Map(),events=[];let frames=0,totalFrameMs=0,renderMs=0;
  const meshes=[];const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  const timing=[];let lastHoverTime=0,needsRender=true;
  const listen=(element,type,handler,options)=>{element.addEventListener(type,handler,options);events.push(()=>element.removeEventListener(type,handler,options))};

  try {
    onProgress('正在载入雪花与银的细节…');
    manifest=await fetch(new URL('model-manifest.json?v=9-connected-chain',assetURL)).then(r=>{if(!r.ok)throw new Error('Manifest fetch '+r.status);return r.json()});
    const bytes=await fetch(new URL(manifest.asset+'?v='+manifest.sha256,assetURL)).then(r=>{if(!r.ok)throw new Error('Model fetch '+r.status);return r.arrayBuffer()});
    if(manifest.sha256){const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==manifest.sha256)throw new Error('Model hash mismatch')}
    gltf=await new GLTFLoader().parseAsync(bytes,assetURL.href);
    assetGroup.add(gltf.scene);
    for(const name of manifest.parts){const node=gltf.scene.getObjectByName(name);if(!node)throw new Error('Missing model part '+name);parts.set(name,node)}
    const sparkleCanvas=document.createElement('canvas');sparkleCanvas.width=256;sparkleCanvas.height=256;
    const cx=sparkleCanvas.getContext('2d');cx.fillStyle='#04789a';cx.fillRect(0,0,256,256);
    let seed=76123;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    for(let i=0;i<9800;i++){const c=rnd();cx.fillStyle=c>.87?'#a8f4ff':c>.60?'#31b9d3':c>.25?'#037993':'#02506a';const s=c>.97?1.5:.7;cx.fillRect(rnd()*256,rnd()*256,s,s)}
    const sparkle=new THREE.CanvasTexture(sparkleCanvas);sparkle.colorSpace=THREE.SRGBColorSpace;sparkle.wrapS=sparkle.wrapT=THREE.RepeatWrapping;sparkle.repeat.set(3,3);resources.add(sparkle);
    const replaced=new Map();
    function polished(mat){
      if(replaced.has(mat.name))return replaced.get(mat.name);
      let next;
      // Retain photographic facet contrast alongside transmitted light. A fully
      // transmitting approximation erased these small facets on a bright stage.
      if(mat.name==='Clear faceted drops'){
        next=new THREE.MeshPhysicalMaterial({color:0xffffff,map:mat.map,emissive:0xffffff,emissiveMap:mat.map,emissiveIntensity:.06,metalness:0,roughness:.025,transmission:.82,thickness:.12,ior:1.52,dispersion:.045,envMapIntensity:1.9,clearcoat:1,clearcoatRoughness:.018,attenuationColor:0xffffff,attenuationDistance:25,flatShading:true});
        // The original facet photograph contains dark surroundings. Keep some
        // facet contrast without turning that photographed shade into absorption.
        next.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, 0.60);')};
        next.customProgramCacheKey=()=> 'clear-facets-060-flat';
      }
      else if(mat.name==='Translucent aqua bead')next=new THREE.MeshPhysicalMaterial({color:0x8acee0,metalness:0,roughness:.09,transmission:.78,thickness:.12,ior:1.45,envMapIntensity:1.2,clearcoat:1});
      else if(mat.name==='Cyan glitter inset')next=new THREE.MeshPhysicalMaterial({color:0x16bed7,map:sparkle,metalness:.45,roughness:.31,clearcoat:.7,clearcoatRoughness:.26,envMapIntensity:1.3});
      else if(mat.name.startsWith('Photographic')){next=mat.clone();next.color.set(0xffffff);next.envMapIntensity=.65;if(mat.name!=='Photographic outer engraving'){next.metalness=.18;next.roughness=.58;next.emissive.set(0xffffff);next.emissiveMap=mat.map;next.emissiveIntensity=.15}}
      else {next=mat.clone();next.envMapIntensity=1.15;if(mat.name==='Aged silver'){next.color.set(0xb8bdb8);next.roughness=.27;next.metalness=.92}if(mat.name==='Raised silver white face'){next.color.set(0xdbe2db);next.metalness=.65;next.roughness=.30}if(mat.name==='Recessed ornament'){next.color.set(0x475751);next.roughness=.46}}
      next.name=mat.name;replaced.set(mat.name,next);resources.add(next);return next;
    }
    gltf.scene.traverse(node=>{
      if(node.isMesh){meshes.push(node);resources.add(node.geometry);const old=Array.isArray(node.material)?node.material:[node.material];old.forEach(m=>{resources.add(m);for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(m[key])resources.add(m[key])});node.material=Array.isArray(node.material)?old.map(polished):polished(old[0]);node.frustumCulled=true;node.userData.partId??=node.parent.userData.partId}
    });
    // Etched rather than painted-looking recesses, still separate editable geometry.
    physics=await createOrnamentPhysics({centerAnchor:manifest.suspension.centerAnchorLocal});
  } catch(error){backgroundTexture.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();resources.forEach(r=>r.dispose());throw error}

  // Display fixed-size metal links along each length-constrained chain. When a
  // chain slackens it bends down; no mesh scaling stretches metal links.
  const chainGeometry=new THREE.TorusGeometry(.032,.010,6,12);resources.add(chainGeometry);
  const chainMaterial=new THREE.MeshStandardMaterial({color:0xa8b0ac,metalness:.92,roughness:.30});resources.add(chainMaterial);
  const chainViews=physics.ropePoints().map(s=>{
    parts.get(s.name).visible=false;
    const count=Math.round(s.length/.065)+1,mesh=new THREE.InstancedMesh(chainGeometry,chainMaterial,count);
    mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);assetGroup.add(mesh);
    return {name:s.name,count,mesh,lastStart:new THREE.Vector3(Infinity,Infinity,Infinity),lastEnd:new THREE.Vector3(Infinity,Infinity,Infinity)};
  });
  // Hide only the separated old link islands. The original clasp, gate, eyes,
  // small snowflake and drop stay attached to their respective moving bodies.
  gltf.scene.traverse(node=>{if(node.userData.role==='continuous lower chain links')node.visible=false});
  const lowerChainViews=physics.lowerChainPoints().map(s=>{
    const mesh=new THREE.InstancedMesh(chainGeometry,chainMaterial,s.count);
    mesh.name=s.name+' continuous chain';mesh.userData.partId=s.name+'Chain';
    mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    assetGroup.add(mesh);meshes.push(mesh);
    return {name:s.name,count:s.count,mesh,owners:[],points:[],lastStart:new THREE.Vector3(Infinity,Infinity,Infinity),lastCorner:new THREE.Vector3(Infinity,Infinity,Infinity),lastEnd:new THREE.Vector3(Infinity,Infinity,Infinity)};
  });
  function ropeCurve(s){
    if(s.points){
      const path=new THREE.CurvePath();
      for(let i=1;i<s.points.length;i++)path.add(new THREE.LineCurve3(s.points[i-1],s.points[i]));
      path.arcLengthDivisions=64;return path;
    }
    const control=s.start.clone().lerp(s.end,.5),distance=s.start.distanceTo(s.end);
    if(distance>=s.length-.002)return new THREE.LineCurve3(s.start,s.end);
    let lo=0,hi=s.length;
    for(let i=0;i<8;i++){
      const sag=(lo+hi)/2,c=control.clone().add(new THREE.Vector3(0,-sag,0));
      const curve=new THREE.QuadraticBezierCurve3(s.start,c,s.end);curve.arcLengthDivisions=24;
      if(curve.getLength()>s.length)hi=sag;else lo=sag;
    }
    const curve=new THREE.QuadraticBezierCurve3(s.start,control.add(new THREE.Vector3(0,-(lo+hi)/2,0)),s.end);curve.arcLengthDivisions=32;return curve;
  }
  const matrix=new THREE.Matrix4(),ropeDown=new THREE.Vector3(0,-1,0),linkScale=new THREE.Vector3(.72,1.23,1),alt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
  const linkPosition=new THREE.Vector3(),linkTangent=new THREE.Vector3(),linkRotation=new THREE.Quaternion();
  function sync(){
    for(const [name,body] of physics.bodies){const node=parts.get(name);if(!node)continue;node.position.copy(vFrom(body.translation()));node.quaternion.copy(qFrom(body.rotation()))}
    const ropes=physics.ropePoints();
    for(const view of chainViews){
      const rope=ropes.find(s=>s.name===view.name);
      if(!rope.points&&rope.start.distanceToSquared(view.lastStart)<1e-9&&rope.end.distanceToSquared(view.lastEnd)<1e-9)continue;
      view.lastStart.copy(rope.start);view.lastEnd.copy(rope.end);const curve=ropeCurve(rope);
      for(let i=0;i<view.count;i++){
        const t=i/(view.count-1);curve.getTangentAt(t,linkTangent);linkRotation.setFromUnitVectors(ropeDown,linkTangent);
        if(i%2)linkRotation.multiply(alt);curve.getPointAt(t,linkPosition);matrix.compose(linkPosition,linkRotation,linkScale);view.mesh.setMatrixAt(i,matrix);
      }
      view.mesh.instanceMatrix.needsUpdate=true;
    }
    for(const chain of physics.lowerChainPoints()){
      const view=lowerChainViews.find(v=>v.name===chain.name);
      if(chain.start.distanceToSquared(view.lastStart)<1e-9&&chain.corner.distanceToSquared(view.lastCorner)<1e-9&&chain.end.distanceToSquared(view.lastEnd)<1e-9)continue;
      view.lastStart.copy(chain.start);view.lastCorner.copy(chain.corner);view.lastEnd.copy(chain.end);
      const curve=lowerChainCurve(chain),sample=linkSamples(curve,view.count);
      view.points=sample.points;view.endInset=sample.endInset;
      const firstLength=chain.start.distanceTo(chain.corner);
      for(let i=0;i<view.count;i++){
        linkRotation.setFromUnitVectors(ropeDown,sample.tangents[i]);if(i%2)linkRotation.multiply(alt);
        matrix.compose(sample.points[i],linkRotation,linkScale);view.mesh.setMatrixAt(i,matrix);
        view.owners[i]=sample.points[i].distanceTo(chain.start)<firstLength?chain.name:chain.name+'Chain';
      }
      view.mesh.instanceMatrix.needsUpdate=true;
    }
    assetGroup.updateMatrixWorld(true);
  }
  const viewTarget=new THREE.Vector3(0,.30,0),viewPosition=new THREE.Vector3();let tween=0;
  function fit(){
    if(drag)cancelDrag();
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();needsRender=true;
    // Frame the hanging exhibit below its mounting ring. All three upper chains
    // remain attached above the viewport; the physical assembly is unchanged.
    const tanHalfFov=Math.tan(THREE.MathUtils.degToRad(17));
    const usableHeight=Math.max(.55,(height-28)/height);
    const distance=detail?5.7:Math.max(2.63/(tanHalfFov*usableHeight),1.45/(tanHalfFov*camera.aspect));
    const targetY=detail?-.30:2.23-distance*tanHalfFov;
    viewPosition.set(distance*.135,targetY+.32,distance);
    viewTarget.set(0,targetY,0);tween=1;
  }
  resizeObserver=new ResizeObserver(fit);resizeObserver.observe(host);fit();camera.position.copy(viewPosition);controls.target.copy(viewTarget);controls.update();
  function partOf(mesh){let node=mesh;while(node){const name=node.userData.partId;if(name&&labels[logicalName(name)]&&physics.bodies.has(name))return name;node=node.parent}return null}
  function pick(e){
    const rect=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
    for(const hit of raycaster.intersectObjects(meshes,false)){
      // Three.js raycasting also visits hidden meshes; excluded static links
      // must not intercept a grab at an obsolete position.
      let visible=true;for(let node=hit.object;node;node=node.parent)visible&&=node.visible;
      if(!visible)continue;
      const view=lowerChainViews.find(v=>v.mesh===hit.object);
      const name=view?view.owners[hit.instanceId]:partOf(hit.object);
      if(name)return {name,point:hit.point};
    }return null;
  }
  function down(e){
    if(mode!=='play'||e.button!==0)return;
    const hit=pick(e);if(!hit)return;const {name,point}=hit;
    if(!physics.startDrag(name,point))return;
    selected=name;renderer.domElement.focus({preventScroll:true});renderer.domElement.setPointerCapture(e.pointerId);
    const normal=camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point);
    drag={name,pointerId:e.pointerId,plane,origin:point.clone(),screenOrigin:new THREE.Vector2(e.clientX,e.clientY),maxPixels:0,started:performance.now()};tween=0;
    renderer.domElement.style.cursor='grabbing';onHint('抓住了'+labels[logicalName(name)]+'，沿手指方向轻拉');e.preventDefault();
  }
  function move(e){
    if(!drag){if(mode==='play'&&performance.now()-lastHoverTime>64){lastHoverTime=performance.now();renderer.domElement.style.cursor=pick(e)?'grab':'default'}return}
    if(e.pointerId!==drag.pointerId)return;
    const rect=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
    const target=raycaster.ray.intersectPlane(drag.plane,new THREE.Vector3());
    if(target){
      const pixels=drag.screenOrigin.distanceTo(new THREE.Vector2(e.clientX,e.clientY));
      drag.maxPixels=Math.max(drag.maxPixels,pixels);
      const gain=.24*Math.max(0,1-4/Math.max(4,pixels));
      physics.updateDrag(target.sub(drag.origin).multiplyScalar(gain).add(drag.origin));
    }e.preventDefault();
  }
  function release(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const tap=e.type==='pointerup'&&drag.maxPixels<=4&&performance.now()-drag.started<500,name=drag.name;
    drag=null;physics.endDrag();
    if(tap)physics.nudge(name);
    renderer.domElement.style.cursor='grab';onHint('松手后，银环缓缓回位，吊坠轻轻回摆');
    if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
  }
  listen(renderer.domElement,'pointerdown',down);listen(renderer.domElement,'pointermove',move);listen(renderer.domElement,'pointerup',release);listen(renderer.domElement,'pointercancel',release);listen(renderer.domElement,'lostpointercapture',release);
  listen(renderer.domElement,'keydown',e=>{
    if(e.code==='Space'){e.preventDefault();physics.nudge();onHint('轻拨了一下')}
    else if(e.code==='Home'){e.preventDefault();reset();onHint('完整显示挂环、三条链和全部吊坠')}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();const sign=['ArrowLeft','ArrowDown'].includes(e.code)?-1:1;physics.nudge(selected,sign);onHint('正在拨动'+labels[logicalName(selected)])}
  });
  listen(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();pause(true);onHint('画面暂时中断，请刷新恢复')});
  function animate(now){
    if(disposed||paused)return;
    frame=requestAnimationFrame(animate);
    const begin=performance.now(),frameInterval=lastTime?now-lastTime:0;
    const elapsed=Math.min(frameInterval/1000,.05);lastTime=now;
    const sleeping=!drag&&!tween&&[...physics.bodies.values()].every(b=>b.isSleeping());
    if(sleeping&&!needsRender&&mode==='play'){accumulator=0;return}
    accumulator+=elapsed;const physicsBegin=performance.now();
    while(accumulator>=physics.fixedDt){physics.step();accumulator-=physics.fixedDt}
    const physicsMs=performance.now()-physicsBegin,syncBegin=performance.now();sync();const syncMs=performance.now()-syncBegin;
    if(tween){camera.position.lerp(viewPosition,.10);controls.target.lerp(viewTarget,.10);if(camera.position.distanceTo(viewPosition)<.003)tween=0}
    controls.update();const start=performance.now();renderer.render(scene,camera);renderMs=performance.now()-start;frames++;needsRender=false;if(frameInterval>0){totalFrameMs+=frameInterval;timing.push({frameMs:frameInterval,physicsMs,syncMs,renderMs,cpuMs:performance.now()-begin});if(timing.length>120)timing.shift()}
  }
  function cancelDrag(){if(drag){const id=drag.pointerId;drag=null;physics.endDrag();if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);onHint('松手后，银环缓缓回位，吊坠轻轻回摆')}renderer.domElement.style.cursor='default'}
  function reset(){cancelDrag();physics.reset();detail=false;fit();sync();needsRender=true}
  function pause(value=true){paused=value;lastTime=0;accumulator=0;if(paused){cancelDrag();cancelAnimationFrame(frame)}else{cancelAnimationFrame(frame);frame=requestAnimationFrame(animate)}}
  function dispose(){if(disposed)return;cancelDrag();disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();events.forEach(fn=>fn());controls.dispose();physics.dispose();backgroundTexture.dispose();environment.dispose();resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove()}
  sync();frame=requestAnimationFrame(animate);
  return {
    reset,nudge(){physics.nudge();onHint('轻拨花纹外环，看看它怎样带动吊坠')},pause,dispose,
    setMode(value){cancelDrag();mode=value;controls.enabled=value==='orbit';onHint(value==='orbit'?'拖动画面，从不同方向看看这件对称吊饰':'抓住银环或吊坠轻拉，松手后看它回摆')},
    setDetail(value){cancelDrag();detail=value;fit()},
    setLighting(dark){backdrop(dark);needsRender=true;renderer.toneMappingExposure=dark?.98:1.0;hemi.intensity=dark?.35:.65;key.intensity=dark?1.2:1.5;fill.intensity=dark?.70:.65;key.color.set(dark?0xffe9b9:0xfffaf0)},
    snapshot(){const p=physics.snapshot();const mean=k=>timing.reduce((s,t)=>s+t[k],0)/Math.max(1,timing.length),percentile=k=>[...timing].sort((a,b)=>a[k]-b[k])[Math.max(0,Math.ceil(timing.length*.95)-1)]?.[k]??0;return {...p,assetVerified:!!manifest.sha256,modelSHA256:manifest.sha256,modelVersion:manifest.version??1,finish:'restored original photographic silver',surfaceProjection:manifest.surfaceProjection??null,structure:manifest.structure,modelBytes:manifest.bytes,threeRevision:THREE.REVISION,mode,detail,paused,disposed,selected,dragging:drag?.name??null,frames,averageFps:Math.round(frames*1000/Math.max(1,totalFrameMs)),recentPerformance:{samples:timing.length,fps:1000/Math.max(1,mean('frameMs')),cpuMeanMs:mean('cpuMs'),cpuP95Ms:percentile('cpuMs'),physicsMeanMs:mean('physicsMs'),syncMeanMs:mean('syncMs'),frameP95Ms:percentile('frameMs')},lastRenderMs:renderMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:{position:camera.position.toArray(),target:controls.target.toArray()},viewport:{width:host.clientWidth,height:host.clientHeight,pixelRatio:renderer.getPixelRatio()}}},
    inspectConnections(){const rect=renderer.domElement.getBoundingClientRect(),project=point=>{const p=point.clone().project(camera);return [rect.left+(p.x*.5+.5)*rect.width,rect.top+(-p.y*.5+.5)*rect.height]};return {dragGain:.24,deadZonePixels:4,upperChains:physics.ropePoints().map(rope=>({name:rope.name,start:rope.start.toArray(),end:rope.end.toArray(),screenStart:project(rope.start),screenEnd:project(rope.end),renderedLinks:chainViews.find(view=>view.name===rope.name).count})),lowerChains:lowerChainViews.map(view=>{
      const centres=[],screenLinkPoints=[],rect=renderer.domElement.getBoundingClientRect();for(let i=0;i<view.count;i++){view.mesh.getMatrixAt(i,matrix);centres.push(new THREE.Vector3().setFromMatrixPosition(matrix));const wire=new THREE.Vector3().fromBufferAttribute(chainGeometry.attributes.position,0).applyMatrix4(matrix).project(camera);screenLinkPoints.push([rect.left+(wire.x*.5+.5)*rect.width,rect.top+(-wire.y*.5+.5)*rect.height])}
      const chain=physics.lowerChainPoints().find(c=>c.name===view.name),spacings=centres.slice(1).map((p,i)=>p.distanceTo(centres[i]));
      return {name:view.name,renderedLinks:view.count,start:chain.start.toArray(),corner:chain.corner.toArray(),end:chain.end.toArray(),centres:centres.map(p=>p.toArray()),screenLinkPoints,startRingCentreDistance:centres[0].distanceTo(chain.start),endRingCentreDistance:centres.at(-1).distanceTo(chain.end),maximumCentreSpacing:Math.max(...spacings),connected:centres[0].distanceTo(chain.start)<.034&&centres.at(-1).distanceTo(chain.end)<.034&&Math.max(...spacings)<.066};
    })}},
    inspectPart(name){let node=parts.get(name)??gltf.scene.getObjectByName(name);const chain=lowerChainViews.find(view=>name===view.name+'Chain');if(chain){node=chain.mesh;node.computeBoundingBox()}if(!node)return null;const b=new THREE.Box3().setFromObject(node);if(b.isEmpty())return null;const center=b.getCenter(new THREE.Vector3()),screen=center.clone().project(camera);const r=renderer.domElement.getBoundingClientRect();const xs=[],ys=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);xs.push(r.left+(p.x*.5+.5)*r.width);ys.push(r.top+(-p.y*.5+.5)*r.height)}return {name,bounds:{min:b.min.toArray(),max:b.max.toArray()},screen:{x:r.left+(screen.x*.5+.5)*r.width,y:r.top+(-screen.y*.5+.5)*r.height,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)}}},
  };
}

import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import {PaintFlow,PIGMENTS} from './paint-flow.js?v=53c533b874f0';

export class Figurine {
  constructor(host,{onProgress=()=>{},onError=()=>{},onDrag=()=>{},whiteOnly=true}={}){
    Object.assign(this,{host,onProgress,onError,onDrag,whiteOnly,ready:false,interactive:false,auto:false,visible:false,rotation:0,progress:0,loading:null});
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.001,10);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0x000000,0);
    this.renderer.toneMapping=THREE.NeutralToneMapping;this.renderer.toneMappingExposure=.8;
    const canvas=this.renderer.domElement;canvas.id='figurine-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','LCF 铃铛三维手办方向键旋转加减缩放Home 恢复默认');canvas.setAttribute('role','img');host.append(canvas);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.enablePan=false;this.controls.enabled=false;
    this.controls.minPolarAngle=.12;this.controls.maxPolarAngle=Math.PI*.89;
    this.controls.addEventListener('start',()=>{this.auto=false;this.onDrag();});
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8d8190,.7));
    const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(-.2,.3,.4);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(.3,.15,-.2);this.scene.add(fill);
    this.rebuildEnvironment();
    this.paintFlow=new PaintFlow();
    this.uniforms={reveal:{value:0},bottom:{value:0},height:{value:.15},reduced:{value:0},pigments:{value:this.paintFlow.values},wetActive:{value:0},wetPhase:{value:0},wetColor:{value:new THREE.Color(PIGMENTS[0].color)}};
    this.resize=()=>{
      const offset=this.camera.position.clone().sub(this.controls.target),previousDistance=this.distance;
      const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
      if(!this.ready)return;
      if(this.interactive&&previousDistance>0&&offset.lengthSq()>0){
        const zoomRatio=offset.length()/previousDistance;this.distance=this.fitDistance();this.controls.maxDistance=this.distance*2.5;
        offset.setLength(THREE.MathUtils.clamp(this.distance*zoomRatio,this.controls.minDistance,this.controls.maxDistance));
        this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
      }else this.reset();
    };
    this.observer=new ResizeObserver(this.resize);this.observer.observe(host);
    this.contextLost=e=>{e.preventDefault();this.lost=true;this.onError('图形显示暂时中断请重新加载模型');};
    canvas.addEventListener('webglcontextlost',this.contextLost);
    this.contextRestored=()=>{try{this.rebuildEnvironment(false);if(this.ready)this.renderer.compile(this.scene,this.camera);this.lost=false;this.onError(null);}catch{this.lost=true;this.onError('图形环境尚未恢复请重新加载模型');}};
    canvas.addEventListener('webglcontextrestored',this.contextRestored);
    canvas.addEventListener('keydown',e=>{if(!this.interactive)return;const k=e.key; if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(k)){e.preventDefault();this.auto=false;this.onDrag();if(k==='Home')this.reset();else if(k==='+'||k==='='||k==='-')this.zoom(k==='-'?1.15:1/1.15);else {const s=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));s.theta+=(k==='ArrowLeft'?.12:k==='ArrowRight'?-.12:0);s.phi=THREE.MathUtils.clamp(s.phi+(k==='ArrowUp'?-.1:k==='ArrowDown'?.1:0),.12,Math.PI*.89);this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();}}});
  }
  rebuildEnvironment(disposePrevious=true){
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
    // A lost context has already released its GPU objects. Disposing its target
    // after restoration would try to delete those objects in the new context.
    try{const environment=pmrem.fromScene(room,.04);this.scene.environment=environment.texture;if(disposePrevious)this.environment?.dispose();this.environment=environment;}
    finally{room.dispose();pmrem.dispose();}
  }
  async verified(file,signal){
    let bytes;
    if(file.gzip&&'DecompressionStream'in window){try{const r=await fetch(file.gzip,{signal});if(!r.ok)throw Error('download');const raw=new Uint8Array(await r.arrayBuffer());bytes=raw[0]===31&&raw[1]===139?await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():raw.buffer;}catch(e){if(signal.aborted)throw e;}}
    if(!bytes){const r=await fetch(file.url,{signal});if(!r.ok)throw Error('资源下载失败');bytes=await r.arrayBuffer();}
    if(bytes.byteLength!==file.bytes)throw Error('资源不完整');
    const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==file.sha256)throw Error('资源版本校验失败');return bytes;
  }
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.abort?.abort();this.abort=new AbortController();const signal=this.abort.signal;
    const timeout=setTimeout(()=>this.abort.abort(new DOMException('Asset loading timed out','TimeoutError')),45000);
    this.loading=(async()=>{
      const response=await fetch('./assets/model-manifest.json',{signal,cache:'no-cache'});if(!response.ok)throw Error('资源清单暂时无法读取');const manifest=await response.json();this.manifest=manifest;
      this.onProgress('正在准备这份三维礼物');
      // Only this fresh display paint is eligible. The rejected historical paint
      // and face-mask buffers are never fetched or used by this path.
      const displayPaint=manifest.displayPaint;
      if(!this.whiteOnly&&(!displayPaint?.runtimeAllowed||displayPaint.modelSHA256!==manifest.model.sha256||displayPaint.referenceArtSHA256!==manifest.referenceArtSHA256))throw Error('展示配色与当前模型不匹配');
      const white=await this.verified(manifest.model,signal);
      const paint=this.whiteOnly?null:await this.verified(displayPaint,signal);
      this.onProgress('正在点亮细节');
      const gltf=await new GLTFLoader().parseAsync(white,document.baseURI);if(signal.aborted)throw new DOMException('Aborted','AbortError');
      this.root=gltf.scene;this.scene.add(this.root);this.root.updateMatrixWorld(true);
      const meshes=[];this.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
      if(meshes.length!==manifest.meshes.length)throw Error('模型与清单不匹配');
      for(let i=0;i<meshes.length;i++){
        const mesh=meshes[i],record=manifest.meshes[i];
        if(mesh.geometry.attributes.position.count!==record.vertices)throw Error('模型与清单不匹配');
        const material=new THREE.MeshStandardMaterial({color:this.whiteOnly?new THREE.Color(.84,.84,.84):0xffffff,vertexColors:!this.whiteOnly,roughness:.76,metalness:0,side:THREE.DoubleSide,envMapIntensity:.16});
        if(!this.whiteOnly){
          const colors=displayPaint.meshes[i];if(colors.vertices!==record.vertices)throw Error('展示配色数量不匹配');
          mesh.geometry.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(paint,colors.offset,record.vertices*3),3,true));
          mesh.geometry.setAttribute('pigmentGroup',new THREE.BufferAttribute(new Uint8Array(paint,colors.groupOffset,record.vertices),1,false));
          this.attachPaintShader(material);
        }
        mesh.material.dispose();mesh.material=material;
      }
      this.addContinuousBrows(meshes[0]);
      this.box=new THREE.Box3().setFromObject(this.root);const center=this.box.getCenter(new THREE.Vector3());
      this.root.position.x-=center.x;this.root.position.z-=center.z;this.root.updateMatrixWorld(true);this.box.setFromObject(this.root);
      this.uniforms.bottom.value=this.box.min.y;this.uniforms.height.value=this.box.max.y-this.box.min.y;
      this.addPodium(this.box.min.y);
      this.ready=true;this.resize();this.reset();this.onProgress('礼物已准备好');
      this.renderer.compile(this.scene,this.camera);
    })().catch(e=>{this.clearModel();throw e;}).finally(()=>{clearTimeout(timeout);this.loading=null;});return this.loading;
  }
  attachPaintShader(material){
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uPigments:this.uniforms.pigments,uBottom:this.uniforms.bottom,uHeight:this.uniforms.height,uReduced:this.uniforms.reduced,uWetActive:this.uniforms.wetActive,uWetPhase:this.uniforms.wetPhase,uWetColor:this.uniforms.wetColor});
      shader.vertexShader='attribute float pigmentGroup;varying float vPigmentGroup;varying vec3 vPaintWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaintWorld=(modelMatrix*vec4(position,1.0)).xyz;vPigmentGroup=pigmentGroup;');
      shader.fragmentShader='uniform float uPigments[6];uniform float uBottom;uniform float uHeight;uniform float uReduced;uniform float uWetActive;uniform float uWetPhase;uniform vec3 uWetColor;varying float vPigmentGroup;varying vec3 vPaintWorld;float lcfWet=0.0;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float y01=(vPaintWorld.y-uBottom)/uHeight;
        float stripe=sin(vPaintWorld.x*570.0+vPaintWorld.z*270.0);
        float drip=pow(.5+.5*stripe,6.0)*.14+sin(vPaintWorld.x*1100.0-vPaintWorld.z*410.0)*.02;
        float amount=0.0;
        for(int i=0;i<6;i++){
          if(abs(vPigmentGroup-(float(i)+1.0))<.5){
            float p=uPigments[i];float front=1.16-p*1.42-drip;
            amount=p<=0.0?0.0:p>=1.0?1.0:mix(smoothstep(front-.045,front+.045,y01),p,uReduced);
          }
        }
        diffuseColor.rgb=mix(vec3(.84),diffuseColor.rgb,amount);
        float front=1.17-uWetPhase*1.44-drip;
        float cover=smoothstep(0.0,.075,uWetPhase)*(1.0-smoothstep(.88,1.0,uWetPhase));
        float wetBody=1.0-smoothstep(front-.055,front+.055,y01);
        float run=exp(-pow((y01-front)/.075,2.0))*.2;
        lcfWet=uWetActive*(1.0-uReduced)*cover*clamp(wetBody*.9+run,0.0,1.0);
        diffuseColor.rgb=mix(diffuseColor.rgb,uWetColor,lcfWet*.9);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.24,lcfWet);');
    };
    material.customProgramCacheKey=()=> 'lcf-whole-body-paint09';
  }
  addContinuousBrows(parent){
    // Fresh front ray picks on display08; continuous display strokes follow its
    // actual closed-eye locations. Original manufacturing assets stay intact.
    const paths=[
      [[-18.6503,97.7267,7.8297],[-17.6303,98.7467,9.0908],[-16.2136,99.8233,10.3128],[-14.5703,100.7867,11.2434],[-12.8703,101.5233,12.2035],[-11.1703,102.0333,12.9724]],
      [[4.6397,104.3567,15.4685],[6.3397,105.4333,15.5855],[8.4364,106,15.6285],[10.4197,106.17,15.3142],[12.2897,105.9433,14.7196]]
    ];
    for(const [index,path]of paths.entries()){
      const curve=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(p[0],p[1],p[2]+(index===0?.23:.16))),false,'centripetal');
      const geometry=new THREE.TubeGeometry(curve,64,.19,8,false),color=new THREE.Color(PIGMENTS[5].color),colors=new Float32Array(geometry.attributes.position.count*3),groups=new Uint8Array(geometry.attributes.position.count).fill(6);
      for(let i=0;i<groups.length;i++)colors.set(color.toArray(),i*3);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('pigmentGroup',new THREE.BufferAttribute(groups,1,false));
      const material=new THREE.MeshStandardMaterial({color:this.whiteOnly?new THREE.Color(.84,.84,.84):0xffffff,vertexColors:!this.whiteOnly,roughness:.76,metalness:0,envMapIntensity:.16});if(!this.whiteOnly)this.attachPaintShader(material);
      const stroke=new THREE.Mesh(geometry,material);stroke.name='continuous-smile-eye-'+index;parent.add(stroke);
    }
  }
  addPodium(bottom){
    this.podium?.geometry.dispose();if(this.podium){[...new Set(this.podium.material)].forEach(m=>m.dispose());this.scene.remove(this.podium);}
    const side=new THREE.MeshStandardMaterial({color:0xd6c7b3,roughness:.7,metalness:0}),top=new THREE.MeshStandardMaterial({color:0xf3ebdf,roughness:.83,metalness:0});
    this.podium=new THREE.Mesh(new THREE.CylinderGeometry(.060,.062,.004,96),[side,top,side]);this.podium.name='round-display-podium';this.podium.position.y=bottom-.002;this.scene.add(this.podium);
  }
  clearModel(){if(this.root){this.scene.remove(this.root);this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.root=null;}if(this.podium){this.scene.remove(this.podium);this.podium.geometry.dispose();[...new Set(this.podium.material)].forEach(m=>m.dispose());this.podium=null;}this.ready=false;}
  fitDistance(){const size=this.box.getSize(new THREE.Vector3());return Math.max((size.y+.004)/2,Math.max(size.x,.124)/Math.max(.5,this.camera.aspect)/2)/Math.tan(THREE.MathUtils.degToRad(16))*1.30;}
  reset(){if(!this.ready)return;const h=this.box.getSize(new THREE.Vector3()).y;this.controls.target.set(0,this.box.min.y+h*.49,0);this.distance=this.fitDistance();this.camera.position.set(0,this.controls.target.y+this.distance*.18,this.distance);this.controls.minDistance=h*.32;this.controls.maxDistance=this.distance*2.5;this.controls.update();}
  view(name){this.reset();const angle=({front:0,back:Math.PI,left:Math.PI/2,right:-Math.PI/2})[name]??0;this.root.rotation.y=0;this.rotation=0;this.camera.position.x=Math.sin(angle)*this.distance;this.camera.position.z=Math.cos(angle)*this.distance;this.controls.update();}
  zoom(factor){const v=this.camera.position.clone().sub(this.controls.target);v.multiplyScalar(factor);v.setLength(THREE.MathUtils.clamp(v.length(),this.controls.minDistance,this.controls.maxDistance));this.camera.position.copy(this.controls.target).add(v);this.controls.update();}
  setProgress(value,reduced=false){this.progress=this.whiteOnly?0:THREE.MathUtils.clamp(value,0,1);this.paintFlow.values.fill(this.progress);this.uniforms.reveal.value=this.progress;this.uniforms.reduced.value=reduced?1:0;}
  resetPaint(){this.paintFlow.reset();this.progress=0;this.uniforms.wetActive.value=0;this.uniforms.wetPhase.value=0;this.uniforms.reduced.value=0;this.auto=false;}
  paintPigment(index,reduced=false){if(!this.ready||!this.visible||this.lost||this.whiteOnly||!this.paintFlow.start(index,reduced))return false;this.auto=false;this.uniforms.wetColor.value.set(PIGMENTS[index].color);this.uniforms.reduced.value=reduced?1:0;return true;}
  setRotation(value){this.rotation=value;if(this.root)this.root.rotation.y=value;}
  setInteractive(value){this.interactive=value;this.controls.enabled=value;}
  frame(dt){if(!this.ready||!this.visible||this.lost)return;this.paintFlow.update(dt);this.uniforms.wetActive.value=this.paintFlow.active>=0?1:0;this.uniforms.wetPhase.value=this.paintFlow.phase;this.progress=this.paintFlow.values.reduce((a,b)=>a+b,0)/this.paintFlow.values.length;if(this.auto)this.setRotation(this.rotation+dt*Math.PI*2/60000);this.controls.update();this.renderer.render(this.scene,this.camera);}
  snapshot(){return {ready:this.ready,whiteOnly:this.whiteOnly,progress:this.progress,paint:this.paintFlow.snapshot(),rotation:this.rotation,interactive:this.interactive,auto:this.auto,camera:this.camera.position.toArray(),target:this.controls.target.toArray(),triangles:this.renderer.info.render.triangles,modelSHA256:this.manifest?.model.sha256??null,paintSHA256:this.whiteOnly?null:this.manifest?.displayPaint?.sha256??null,sourceModelSHA256:(this.manifest?.sourceModel??this.manifest?.model)?.sha256??null};}
  dispose(){this.abort?.abort();this.observer.disconnect();this.controls.dispose();this.clearModel();this.environment.dispose();this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);this.renderer.dispose();this.renderer.domElement.remove();}
}

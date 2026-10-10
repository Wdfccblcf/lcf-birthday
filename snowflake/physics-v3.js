import * as THREE from './vendor/three/build/three.module.js';
import RAPIER from './vendor/rapier/rapier.js';

let initialization;
const Z={x:0,y:0,z:0}, I={x:0,y:0,z:0,w:1};
const down=new THREE.Vector3(0,-1,0), X=new THREE.Vector3(1,0,0), Y=new THREE.Vector3(0,1,0), AZ=new THREE.Vector3(0,0,1);
const v=p=>new THREE.Vector3(p.x,p.y,p.z), q=r=>new THREE.Quaternion(r.x,r.y,r.z,r.w);
const branchNames=['CrystalBranch1','CrystalBranch2','CrystalBranch3','CrystalBranch4','BlueBranch'];
const attachmentPoints=[[-1,0,0],[1,0,0],[0,0,1],[0,0,-1],[0,0,.795]].map(a=>new THREE.Vector3(...a));

/** All visible moving parts are dynamic. A damped display support returns the
 * engraved outer ring to its resting pose, while a temporary mouse target can
 * displace it. Length constraints carry forces through the common
 * mount, side chains, rings and articulated lower chains. Dimensions/masses are
 * approximate: 1 relative model unit = assumed 5 cm, gravity = 9.81 m/s². */
export async function createOrnamentPhysics({gravity=9.81,metersPerUnit=.05,displayAnchor=true,centerAnchor=[.0071522235236270324,0,-.9253479739319626]}={}){
  initialization??=RAPIER.init();await initialization;
  const dt=1/240, world=new RAPIER.World({x:0,y:-gravity/metersPerUnit,z:0});world.timestep=dt;
  world.integrationParameters.numSolverIterations=24;
  const bodies=new Map(),joints=[],suspensions=[],nominal=new Map();
  const centerColliders=[],ringColliders=new Map();
  const support=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,3.28,0));
  let steps=0,disposed=false,drag=null,peakMouseError=0;
  const yaw=new THREE.Quaternion().setFromAxisAngle(Y,.18);
  const middle=yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X,Math.PI*82/180));
  const inner=middle.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AZ,-Math.PI*24/180));
  const core=inner.clone();
  function create(name,mass,com,inertia,position=Z,rotation=I,damping=.28){
    const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation)
      .setAdditionalMassProperties(mass,com,inertia,I).setLinearDamping(.18).setAngularDamping(damping));
    bodies.set(name,b);nominal.set(name,{position:{...position},rotation:{x:rotation.x,y:rotation.y,z:rotation.z,w:rotation.w}});return b;
  }
  function join(type,parent,child,a,b,axis){
    const data=type==='hinge'?RAPIER.JointData.revolute(a,b,axis):RAPIER.JointData.spherical(a,b);
    const joint=world.createImpulseJoint(data,parent,child,true);joint.setContactsEnabled(false);
    // Keep the earlier assembly's resting angles, with finite joint stiffness
    // and damping. Bodies still respond to gravity and a picked-point force.
    if(type==='hinge'){
      const relative=q(parent.rotation()).invert().multiply(q(child.rotation()));
      const restAngle=2*Math.atan2(new THREE.Vector3(relative.x,relative.y,relative.z).dot(axis),relative.w);
      joint.configureMotorPosition(restAngle,1.3,.18);
    }
    joints.push({type,parent,child,a:v(a),b:v(b),joint});return joint;
  }
  const mount=create('TopMount',.018,{x:0,y:3.04,z:0},{x:.0014,y:.0007,z:.0014});
  join('pin',support,mount,Z,{x:0,y:3.28,z:0});
  const outer=create('OuterRing',.045,Z,{x:.023,y:.045,z:.023},Z,yaw,1.5);
  const m=create('MiddleRing',.035,Z,{x:.015,y:.030,z:.015},Z,middle,1.2);
  const n=create('InnerRing',.028,Z,{x:.010,y:.020,z:.010},Z,inner,1.2);
  const c=create('SnowflakeCore',.055,Z,{x:.0085,y:.0145,z:.0085},Z,core,1.2);
  // A finite spring-and-damper support, not a pose reset: the outer ring still
  // moves under a touch, transmits load to its pendants, and returns after release.
  const anchor={positionStiffness:30,positionDamping:6,rotationStiffness:10,rotationDamping:2.2};
  const anchorForce=new THREE.Vector3(),anchorTorque=new THREE.Vector3(),anchorError=new THREE.Quaternion();
  function restoreDisplayAnchor(){
    if(!displayAnchor)return;
    const rest=nominal.get('OuterRing');
    anchorForce.copy(v(rest.position)).sub(v(outer.translation())).multiplyScalar(anchor.positionStiffness)
      .addScaledVector(v(outer.linvel()),-anchor.positionDamping);
    anchorError.copy(q(rest.rotation)).multiply(q(outer.rotation()).invert()).normalize();
    if(anchorError.w<0)anchorError.set(-anchorError.x,-anchorError.y,-anchorError.z,-anchorError.w);
    const sine=Math.hypot(anchorError.x,anchorError.y,anchorError.z);
    anchorTorque.set(anchorError.x,anchorError.y,anchorError.z)
      .multiplyScalar(sine>1e-8?2*Math.atan2(sine,anchorError.w)*anchor.rotationStiffness/sine:0)
      .addScaledVector(v(outer.angvel()),-anchor.rotationDamping);
    // Rapier keeps user forces until cleared. Replace the support force each
    // step and avoid waking an already settled assembly for round-off errors.
    outer.resetForces(false);outer.resetTorques(false);
    outer.addForce(anchorForce,false);outer.addTorque(anchorTorque,false);
  }
  join('hinge',outer,m,Z,Z,X);join('hinge',m,n,Z,Z,AZ);join('hinge',n,c,Z,Z,X);
  // Preserve V2: the core rotates inside the inner ring and shares its centre.
  const apexY=2.62;
  const coreEye=new THREE.Vector3(...centerAnchor);
  const centerLength=new THREE.Vector3(0,apexY,0).distanceTo(coreEye.clone().applyQuaternion(core));
  for(const [name,body,anchor,length] of [
    ['UpperLeft',outer,new THREE.Vector3(-1,0,0),Math.hypot(apexY,1)],
    ['UpperRight',outer,new THREE.Vector3(1,0,0),Math.hypot(apexY,1)],
    ['UpperCenter',c,coreEye,centerLength],
  ]){
    const a=new THREE.Vector3(0,apexY,0);
    if(name==='UpperCenter'){
      // A rope joint alone has no collision surface. This load-bearing chain
      // needs articulated segments so a ring can push it aside, not pass through
      // a prescribed visual curve. The existing core eye remains its endpoint.
      const start=point(mount,a),end=point(body,anchor),segments=[],count=4;
      const segmentLength=length/count,rotation=new THREE.Quaternion().setFromUnitVectors(down,end.clone().sub(start).normalize());
      let previous=mount,previousAnchor=a;
      for(let j=0;j<count;j++){
        const mass=.006/count;
        const segment=create('UpperCenterSegment'+(j+1),mass,{x:0,y:-segmentLength/2,z:0},
          {x:mass*segmentLength**2/12,y:mass*.0006,z:mass*segmentLength**2/12},start.clone().lerp(end,j/count),rotation,2.0);
        segment.setLinearDamping(.80);
        segment.enableCcd(true);
        join('chain',previous,segment,previousAnchor,Z);
        // The terminal link overlaps the existing jump ring at its pivot. Leave
        // that one interlocking joint clear, as with adjacent chain joints.
        const jointClearance=j===count-1?.03:0;
        const collider=world.createCollider(RAPIER.ColliderDesc.capsule((segmentLength-jointClearance)/2-.035,.035)
          .setTranslation(0,-(segmentLength-jointClearance)/2,0).setDensity(0).setFriction(.22).setRestitution(0)
          .setCollisionGroups(0x00080001),segment);
        // A small predictive margin keeps thin rendered wire outside the band
        // while the iterative contact and suspension solver share the load.
        collider.setContactSkin(.012);
        centerColliders.push(collider);segments.push(segment);
        previous=segment;previousAnchor={x:0,y:-segmentLength,z:0};
      }
      join('chain',previous,body,previousAnchor,anchor);
      suspensions.push({name,parent:mount,child:body,a,b:anchor,length,segments,segmentLength});
    }else{
      const joint=world.createImpulseJoint(RAPIER.JointData.rope(length,a,anchor),mount,body,true);
      suspensions.push({name,parent:mount,child:body,a,b:anchor,length,joint});
    }
  }
  // Thin compound band colliders leave the openings free.
  for(const [body,radius,width,thickness] of [[outer,1,.140,.028],[m,.923,.120,.025],[n,.845,.115,.023]]){
    body.enableCcd(true);
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16,rotation=new THREE.Quaternion().setFromAxisAngle(Y,-angle);
      const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(thickness/2,width/2,radius*Math.sin(Math.PI/32))
        .setTranslation(radius*Math.cos(angle),0,radius*Math.sin(angle)).setRotation(rotation)
        .setDensity(0).setFriction(.22).setRestitution(.02).setCollisionGroups(0x0001000f),body);
      ringColliders.set(collider.handle,body===m?'MiddleRing':body===n?'InnerRing':'OuterRing');
    }
  }
  world.createCollider(RAPIER.ColliderDesc.cylinder(.052,.735).setDensity(0).setFriction(.18).setRestitution(.02).setCollisionGroups(0x00020005),c);
  branchNames.forEach((name,i)=>{
    const parent=i===4?c:outer,anchor=attachmentPoints[i],chainLength=i===4?1.32:.44;
    const segmentLength=chainLength/2,origin=anchor.clone().applyQuaternion(q(parent.rotation())).add(v(parent.translation()));
    let previous=parent,previousAnchor=anchor;
    for(let j=0;j<2;j++){
      const mass=i===4?.0015:.0012;
      const b=create(name+(j?'Chain':''),mass,{x:0,y:-segmentLength/2,z:0},
        {x:mass*segmentLength**2/12,y:mass*.0004,z:mass*segmentLength**2/12},origin.clone().addScaledVector(down,j*segmentLength),I,1.6);
      b.setLinearDamping(.65);
      join('chain',previous,b,previousAnchor,Z);previous=b;previousAnchor={x:0,y:-segmentLength,z:0};
    }
    const payload=create(name+'Payload',i===4?.012:.025,{x:0,y:i===4?-.51:-.76,z:0},
      i===4?{x:.0007,y:.00013,z:.0007}:{x:.0031,y:.00025,z:.0031},origin.clone().addScaledVector(down,chainLength),I,1.6);
    payload.setLinearDamping(.65);
    join('chain',previous,payload,previousAnchor,Z);
    if(i===4)world.createCollider(RAPIER.ColliderDesc.ball(.107).setTranslation(0,-.665,0).setDensity(0).setFriction(.15).setRestitution(.02).setCollisionGroups(0x00040007),payload);
    else world.createCollider(RAPIER.ColliderDesc.capsule(.26,.10).setTranslation(0,-.83,0).setDensity(0).setFriction(.15).setRestitution(.02).setCollisionGroups(0x00040007),payload);
    world.createCollider(RAPIER.ColliderDesc.cuboid(.156,.19,.025).setTranslation(0,i===4?-.22:-.205,0).setDensity(0).setFriction(.18).setCollisionGroups(0x00040007),payload);
  });
  function point(body,local){return v(local).applyQuaternion(q(body.rotation())).add(v(body.translation()))}
  function endDrag(){
    if(!drag)return;
    world.removeImpulseJoint(drag.joint,true);world.removeRigidBody(drag.hand);drag=null;
    // Release removes the hand constraint without adding a fabricated impulse.
  }
  function startDrag(name,worldPoint){
    endDrag();const body=bodies.get(name);if(!body)return false;
    const p=v(worldPoint),local=p.clone().sub(v(body.translation())).applyQuaternion(q(body.rotation()).invert());
    const hand=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y,p.z));
    const joint=world.createImpulseJoint(RAPIER.JointData.spring(0,22,2.8,local,Z),body,hand,true);
    joint.setContactsEnabled(false);body.wakeUp();
    drag={name,body,hand,joint,local,origin:p.clone(),target:p.clone(),position:p.clone()};return true;
  }
  function updateDrag(target){
    if(!drag)return;const p=v(target),delta=p.sub(drag.origin);const maximum=drag.name.includes('Branch')?.28:.32;
    if(delta.length()>maximum)delta.setLength(maximum);drag.target.copy(drag.origin).add(delta);
  }
  function nudge(name='OuterRing',direction=1){
    const body=bodies.get(name);if(!body)return;
    let local=name.includes('Payload')?{x:0,y:name.startsWith('Blue')?-.665:-.85,z:0}:name.includes('Branch')?{x:0,y:-.2,z:0}:{x:1,y:0,z:0};
    let impulse=name.includes('Branch')?{x:direction*.0025,y:0,z:.0006}:{x:0,y:0,z:direction*.040};
    if(name==='TopMount'){local={x:.265,y:3.06,z:0};impulse={x:0,y:0,z:direction*.004}}
    if(name==='MiddleRing'){local={x:0,y:0,z:.923};impulse=v({x:0,y:direction*.006,z:0}).applyQuaternion(q(body.rotation()))}
    if(name==='InnerRing'){local={x:.845,y:0,z:0};impulse=v({x:0,y:direction*.005,z:0}).applyQuaternion(q(body.rotation()))}
    body.applyImpulseAtPoint(impulse,point(body,local),true);
  }
  function reset(){
    endDrag();for(const [name,b] of bodies){const pose=nominal.get(name);b.setTranslation(pose.position,true);b.setRotation(pose.rotation,true);b.setLinvel(Z,true);b.setAngvel(Z,true);b.resetForces(true);b.resetTorques(true)}
    peakMouseError=0;
  }
  function step(){
    if(disposed)return;
    if(drag){const delta=drag.target.clone().sub(drag.position);if(delta.length()>.40*dt)delta.setLength(.40*dt);drag.position.add(delta);drag.hand.setNextKinematicTranslation(drag.position)}
    restoreDisplayAnchor();
    world.step();steps++;
    if(drag)peakMouseError=Math.max(peakMouseError,point(drag.body,drag.local).distanceTo(drag.position));
  }
  function ropePoints(){return suspensions.map(s=>({name:s.name,start:point(s.parent,s.a),end:point(s.child,s.b),length:s.length,
    ...(s.segments?{points:[point(s.parent,s.a),...s.segments.slice(1).map(b=>v(b.translation())),point(s.child,s.b)]}:{})}))}
  function centerContacts(){
    const contacts=[];let minimumDistance=Infinity,preSolvePenetration=0;
    for(const collider of centerColliders)world.contactPairsWith(collider,other=>{
      const ring=ringColliders.get(other.handle);if(!ring)return;
      // Narrow-phase manifolds describe the contacts before this step's solver.
      // Query the final shapes as well, so the audit measures displayed overlap.
      const contact=collider.contactCollider(other,.02);
      if(contact){minimumDistance=Math.min(minimumDistance,contact.distance);if(contact.distance<=.015)contacts.push({ring,distance:contact.distance});}
      world.contactPair(collider,other,manifold=>{
        for(let i=0;i<manifold.numContacts();i++){
          preSolvePenetration=Math.max(preSolvePenetration,-manifold.contactDist(i));
        }
      });
    });
    return {segments:centerColliders.length,ccd:true,contactCount:contacts.length,maxPenetration:Math.max(0,-minimumDistance),preSolvePenetration,contacts};
  }
  function lowerChainPoints(){return branchNames.map((name,i)=>({name,
    start:point(bodies.get(name),{x:0,y:-.196,z:0}),
    corner:v(bodies.get(name+'Chain').translation()),
    end:point(bodies.get(name+'Payload'),{x:0,y:i===4?-.006:-.002,z:0}),
    count:i===4?19:4,
  }))}
  function snapshot(){
    const poses={};let maxJointError=0,maxRopeExtension=0;
    for(const [name,b] of bodies)poses[name]={p:{...b.translation()},q:{...b.rotation()},angularSpeed:v(b.angvel()).length(),linearSpeed:v(b.linvel()).length(),sleeping:b.isSleeping(),dynamic:b.isDynamic()};
    for(const j of joints)maxJointError=Math.max(maxJointError,point(j.parent,j.a).distanceTo(point(j.child,j.b)));
    const ropes=ropePoints().map(s=>{const distance=s.start.distanceTo(s.end);maxRopeExtension=Math.max(maxRopeExtension,Math.max(0,distance-s.length));return {name:s.name,start:s.start.toArray(),end:s.end.toArray(),length:s.length,distance,slack:Math.max(0,s.length-distance)}});
    const values=Object.values(poses).flatMap(p=>[...Object.values(p.p),...Object.values(p.q),p.angularSpeed,p.linearSpeed]);
    const rest=nominal.get('OuterRing');
    return {engine:'Rapier',version:RAPIER.version(),suspensionVersion:11,steps,fixedDt:dt,solverIterations:24,bodyCount:bodies.size+1+(drag?1:0),jointCount:joints.length+suspensions.filter(s=>s.joint).length+(drag?1:0),finite:values.every(Number.isFinite),maxJointError,maxAnchorError:maxJointError,maxRopeExtension,ropes,centerChainCollision:centerContacts(),peakMouseError,handSpeedLimit:.40,
      displayAnchor:{enabled:displayAnchor,body:'OuterRing',positionError:v(outer.translation()).distanceTo(v(rest.position)),angleErrorDegrees:THREE.MathUtils.radToDeg(q(outer.rotation()).normalize().angleTo(q(rest.rotation).normalize())),...anchor},
      gravityMPS2:gravity,assumedMetersPerUnit:metersPerUnit,draggingBody:drag?.name??null,poses};
  }
  world.step();reset();
  return {fixedDt:dt,step,reset,nudge,startDrag,updateDrag,endDrag,bodies,nominal,ropePoints,lowerChainPoints,snapshot,point,
    dispose(){if(!disposed){endDrag();disposed=true;world.free()}}};
}

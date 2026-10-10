import * as THREE from './vendor/three/build/three.module.js';

// A short fillet follows the real articulated joint without introducing the
// overshoot of a spline. Metal links keep their own dimensions at every pose.
export function lowerChainCurve({start,corner,end}){
  const first=corner.clone().sub(start),second=end.clone().sub(corner);
  const radius=Math.min(.018,first.length()*.25,second.length()*.25);
  if(radius<1e-6)return new THREE.LineCurve3(start,end);
  const before=corner.clone().addScaledVector(first.normalize(),-radius);
  const after=corner.clone().addScaledVector(second.normalize(),radius);
  const path=new THREE.CurvePath();
  path.add(new THREE.LineCurve3(start,before));
  path.add(new THREE.QuadraticBezierCurve3(before,corner,after));
  path.add(new THREE.LineCurve3(after,end));
  path.arcLengthDivisions=64;return path;
}

export function linkSamples(curve,count){
  const length=curve.getLength(),endInset=Math.min(.030,length*.18);
  const span=length-2*endInset;
  const points=[],tangents=[];
  for(let i=0;i<count;i++){
    const u=(endInset+span*i/(count-1))/Math.max(1e-8,length);
    points.push(curve.getPointAt(u));tangents.push(curve.getTangentAt(u));
  }
  return {points,tangents,length,endInset};
}

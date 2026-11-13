export const sceneLayers=[3,5,7,5,1] as const;
export interface SignalPath {from:number[];to:number[];layer:number;offset:number;bow:number}
export function signalPoint(path:SignalPath,t:number) {
  const p=Math.max(0,Math.min(1,t)),ease=p*p*(3-2*p);
  return [path.from[0]+(path.to[0]-path.from[0])*p,path.from[1]+(path.to[1]-path.from[1])*ease,path.from[2]+(path.to[2]-path.from[2])*ease+Math.sin(p*Math.PI)*path.bow];
}
export function signalCycle(time:number) {
  const depth=sceneLayers.length-1,travel=depth*0.85,total=travel*2+1.8,t=((time%total)+total)%total;
  return {time:t,depth,travel,total,phase:t<travel?0:t<travel+0.9?1:t<travel*2+0.9?2:3};
}
export function signalProgress(time:number,layer:number,offset=0) {
  const cycle=signalCycle(time),reverse=cycle.phase===2;
  const elapsed=reverse?cycle.time-cycle.travel-0.9-(cycle.depth-1-layer)*0.85:cycle.time-layer*0.85;
  const p=(elapsed-offset)/0.85;
  return {progress:reverse?1-p:p,visible:(cycle.phase===0||reverse)&&p>=0&&p<=1,reverse};
}

/** Layered artificial network: 21 neurons, 90 weighted connections, all paths feed forward. */
export function makeNeuralGeometry() {
  const positions:number[]=[],colors:number[]=[],lines:number[]=[],lineColors:number[]=[],cores:number[]=[],coreColors:number[]=[],paths:SignalPath[]=[];
  const nodes=sceneLayers.map((count,layer)=>Array.from({length:count},(_,neuron)=>{
    const y=(neuron-(count-1)/2)*0.38;
    return [layer*1.04-2.08,y,Math.sin(neuron*1.5+layer*0.8)*0.22];
  }));
  nodes.forEach((layer,l)=>layer.forEach((node,n)=>{
    const color=l===0?[0.35,0.85,1]:l===nodes.length-1?[0.63,1,0.88]:[0.42+l*0.05,0.57,1];
    cores.push(...node);coreColors.push(...color);
    for(let i=0;i<100;i++) {
      const y=1-2*(i+0.5)/100,r=Math.sqrt(1-y*y),angle=i*2.39996322973,radius=0.105;
      positions.push(node[0]+Math.cos(angle)*r*radius,node[1]+y*radius,node[2]+Math.sin(angle)*r*radius);
      colors.push(...color.map(v=>v*(0.65+Math.sin(i+n)*0.15)));
    }
    // Small orbital filaments make the neuron volume visible from oblique angles.
    for(let i=0;i<40;i++){
      const a=i/40*Math.PI*2,b=(i+1)/40*Math.PI*2;
      for(const t of [a,b]){lines.push(node[0]+Math.cos(t)*0.15,node[1]+Math.sin(t)*0.15,node[2]);lineColors.push(...color);}
    }
  }));
  for(let layer=0;layer<nodes.length-1;layer++)nodes[layer].forEach((from,i)=>nodes[layer+1].forEach((to,j)=>{
    const path={from,to,layer,offset:(i+j)%3*0.065,bow:Math.sin(i*2+j)*0.18};paths.push(path);
    const color=(i+j)%4===0?[0.51,0.36,0.91]:[0.23,0.48,0.88];
    for(let segment=0;segment<16;segment++)for(const t of [segment/16,(segment+1)/16]){lines.push(...signalPoint(path,t));lineColors.push(...color);}
  }));
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),lines:new Float32Array(lines),lineColors:new Float32Array(lineColors),cores:new Float32Array(cores),coreColors:new Float32Array(coreColors),paths,nodes};
}
export function projectNeuralPoint(point:readonly number[],rotation:number,tilt:number,aspect:number) {
  const [x,y,z]=point,rx=x*Math.cos(rotation)+z*Math.sin(rotation),rz=-x*Math.sin(rotation)+z*Math.cos(rotation);
  const ry=y*Math.cos(tilt)-rz*Math.sin(tilt),depth=6.2-(y*Math.sin(tilt)+rz*Math.cos(tilt));
  const focal=3.2*Math.min(1,aspect/1.4);
  return [rx*focal/depth/aspect,ry*focal/depth+(aspect<1.4?0.22:0.1),depth] as const;
}

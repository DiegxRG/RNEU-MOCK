import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Pause, Play, RotateCcw, RotateCw, Sparkles } from 'lucide-react';
import { makeNeuralGeometry, projectNeuralPoint, signalPoint, signalProgress, signalCycle, sceneLayers } from '../visuals/neural-scene.ts';

const vertex=`
attribute vec3 aPosition; attribute vec3 aColor;
uniform float uTime; uniform float uRotation; uniform float uTilt; uniform float uAspect;
uniform float uSize; uniform float uPixelRatio; uniform float uEnergy;
varying vec3 vColor;
void main(){
  float cy=cos(uRotation),sy=sin(uRotation),cx=cos(uTilt),sx=sin(uTilt);
  vec3 p=vec3(aPosition.x*cy+aPosition.z*sy,aPosition.y,-aPosition.x*sy+aPosition.z*cy);
  p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);
  float depth=6.2-p.z;
  float focal=3.2*min(1.0,uAspect/1.4);
  float lift=uAspect<1.4?0.22:0.1;
  gl_Position=vec4(p.x*focal/depth/uAspect,p.y*focal/depth+lift,(depth-1.0)/10.0,1.0);
  float shimmer=0.75+0.25*sin(aPosition.y*12.0+aPosition.x*8.0-uTime*0.65);
  vColor=aColor*shimmer*(0.8+uEnergy*0.5);
  gl_PointSize=uSize*uPixelRatio*(4.0/depth);
}`;
const fragment=`
precision mediump float;
uniform float uPoints; uniform float uAlpha; uniform float uTime;
varying vec3 vColor;
void main(){
  float alpha=uAlpha;
  if(uPoints>0.5){
    float d=length(gl_PointCoord-0.5)*2.0;
    if(d>1.0)discard;
    float core=exp(-d*d*24.0),aura=pow(max(0.0,1.0-d),2.8);
    alpha*=core+aura*0.55;
  }
  gl_FragColor=vec4(vColor,alpha);
}`;

export function NeuralScene({paused,onPausedChange,login}:{paused:boolean;onPausedChange:(value:boolean)=>void;login:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null);
  const [fallback,setFallback]=useState(false),[energy,setEnergy]=useState(0.65),[phase,setPhase]=useState(0);
  const motion=useReducedMotion();
  const controls=useRef({paused:false,energy:0.65,rotation:-0.22,tilt:0.1,drag:false,lastX:0,lastY:0,burst:0});
  controls.current.paused=paused||Boolean(motion);controls.current.energy=energy;
  useEffect(()=>{
    const element=canvas.current,container=host.current;if(!element||!container)return;
    const gl=element.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!gl){setFallback(true);return;}
    const shader=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('No se pudo compilar la escena.');}return shader;};
    let program:WebGLProgram,vs:WebGLShader,fs:WebGLShader;
    try{vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('WebGL no disponible');}
    catch{setFallback(true);return;}
    gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    const geometry=makeNeuralGeometry();
    const buffers:WebGLBuffer[]=[];
    const buffer=(data:Float32Array,dynamic=false)=>{const b=gl.createBuffer()!;buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);return b;};
    const pointBuffer=buffer(geometry.positions),colorBuffer=buffer(geometry.colors),lineBuffer=buffer(geometry.lines),lineColorBuffer=buffer(geometry.lineColors);
    const coreBuffer=buffer(geometry.cores),coreColorBuffer=buffer(geometry.coreColors);
    const flow=new Float32Array(geometry.paths.length*9*3),flowColors=new Float32Array(flow.length);
    for(let i=0;i<flow.length/3;i++)flowColors.set([0.28,0.72,1],i*3);
    const flowBuffer=buffer(flow,true),flowColorBuffer=buffer(flowColors,true);
    const position=gl.getAttribLocation(program,'aPosition'),color=gl.getAttribLocation(program,'aColor');
    gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(color);
    const names=['uTime','uRotation','uTilt','uAspect','uSize','uPixelRatio','uEnergy','uPoints','uAlpha'] as const;
    const uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)])) as Record<typeof names[number],WebGLUniformLocation>;
    let width=1,height=1,pixel=1,frame=0,last=0,time=0,visible=true,disposed=false,lastState='',lastPhase=-1;
    const resize=()=>{const box=container.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);pixel=Math.min(window.devicePixelRatio||1,1.75);element.width=Math.round(width*pixel);element.height=Math.round(height*pixel);gl.viewport(0,0,element.width,element.height);draw();};
    const draw=()=>{
      const state=controls.current;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uRotation,state.rotation+Math.sin(time*0.12)*0.12);gl.uniform1f(uniforms.uTilt,state.tilt);gl.uniform1f(uniforms.uAspect,width/height);gl.uniform1f(uniforms.uPixelRatio,pixel);gl.uniform1f(uniforms.uEnergy,state.energy+state.burst);
      const render=(positions:WebGLBuffer,colors:WebGLBuffer,count:number,type:number,size:number,alpha:number)=>{gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,colors);gl.vertexAttribPointer(color,3,gl.FLOAT,false,0,0);gl.uniform1f(uniforms.uPoints,type===gl.POINTS?1:0);gl.uniform1f(uniforms.uSize,size);gl.uniform1f(uniforms.uAlpha,alpha);gl.drawArrays(type,0,count);};
      render(lineBuffer,lineColorBuffer,geometry.lines.length/3,gl.LINES,1,0.23);
      render(pointBuffer,colorBuffer,geometry.positions.length/3,gl.POINTS,3.2,0.85);
      render(coreBuffer,coreColorBuffer,geometry.cores.length/3,gl.POINTS,80,0.46);
      render(coreBuffer,coreColorBuffer,geometry.cores.length/3,gl.POINTS,17,1);
      geometry.paths.forEach((path,index)=>{for(let trail=0;trail<9;trail++){
        const signal=signalProgress(time-trail*0.025,path.layer,path.offset),offset=(index*9+trail)*3;
        flow.set(signal.visible?signalPoint(path,signal.progress):[99,99,0],offset);
        flowColors.set(signal.reverse?[0.72,0.48,1]:[0.32,0.82,1],offset);
      }});
      const nextPhase=signalCycle(time).phase;if(nextPhase!==lastPhase){lastPhase=nextPhase;setPhase(nextPhase);}
      gl.bindBuffer(gl.ARRAY_BUFFER,flowBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,flow);gl.bindBuffer(gl.ARRAY_BUFFER,flowColorBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,flowColors);
      render(flowBuffer,flowColorBuffer,flow.length/3,gl.POINTS,25+state.burst*18,0.22);
    };
    const loop=(now:number)=>{if(disposed)return;const delta=Math.min((now-last)/1000,0.05);last=now;if(visible&&!document.hidden){const state=controls.current;if(!state.paused){time+=delta;state.burst=Math.max(0,state.burst-delta*0.35);}const signature=`${state.rotation}/${state.tilt}/${state.energy}/${state.burst}`;if(!state.paused||signature!==lastState)draw();lastState=signature;}frame=requestAnimationFrame(loop);};
    const ro=new ResizeObserver(resize);ro.observe(container);const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});io.observe(container);
    const lost=(event:Event)=>{event.preventDefault();disposed=true;cancelAnimationFrame(frame);setFallback(true);};element.addEventListener('webglcontextlost',lost);
    resize();frame=requestAnimationFrame(loop);
    return()=>{disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();element.removeEventListener('webglcontextlost',lost);buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  },[]);
  const fallbackGeometry=fallback?makeNeuralGeometry():null;
  const project=(point:number[])=>projectNeuralPoint(point,-0.22,0.1,1.5);
  const stages=['Propagación de la señal','Comparación con el objetivo','Retropropagación del error','Actualización de los pesos'];
  return <div className={`neural-experience ${login?'is-connecting':''}`}>
    <div ref={host} className="neural-scene" role="group" aria-label="Red neuronal artificial tridimensional con capas, conexiones y señales de aprendizaje">
      <div className="neural-stage-rings" aria-hidden="true"><i/><i/></div>
      {!fallback?<canvas ref={canvas} className="neural-canvas" aria-label="Arrastra para girar la red. También puedes usar los botones de giro." onPointerDown={event=>{controls.current.drag=true;controls.current.lastX=event.clientX;controls.current.lastY=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const s=controls.current;if(!s.drag)return;s.rotation+=(event.clientX-s.lastX)*0.005;s.tilt=Math.max(-0.45,Math.min(0.45,s.tilt+(event.clientY-s.lastY)*0.003));s.lastX=event.clientX;s.lastY=event.clientY;}} onPointerUp={()=>{controls.current.drag=false}} onPointerCancel={()=>{controls.current.drag=false}}/>:<svg viewBox="-1 -0.7 2 1.4" className="neural-canvas" role="img" aria-label="Vista estática de la red neuronal. WebGL no está disponible.">{fallbackGeometry?.paths.map((path,index)=>{const from=project(path.from),to=project(path.to);return <line key={index} x1={from[0]} y1={-from[1]} x2={to[0]} y2={-to[1]} stroke="#719dff" strokeWidth="0.001" opacity="0.3"/>})}{fallbackGeometry?.nodes.flatMap((layer,l)=>layer.map((node,n)=>{const p=project(node);return <g key={`${l}-${n}`}><circle cx={p[0]} cy={-p[1]} r="0.022" fill="#5e94ff" opacity="0.3"/><circle cx={p[0]} cy={-p[1]} r="0.007" fill="#a3e3ff"/></g>}))}</svg>}
      <div className="neural-layer-labels" aria-hidden="true">{sceneLayers.map((count,index)=><span key={index}><strong>{index===0?'Entradas':index===4?'Predicción':`Capa ${index}`}</strong><small>{count} {count===1?'neurona':'neuronas'}</small></span>)}</div>
      <div className="neural-live-caption"><span className="landing-signal"/><span>{fallback?'Una arquitectura conectada':stages[phase]}</span><span className="neural-caption-type">Representación conceptual</span></div>
    </div>
    <div className="neural-controls-dock"><div className="neural-controls"><button type="button" disabled={Boolean(motion)||fallback} onClick={()=>onPausedChange(!paused)} aria-pressed={paused}>{paused||motion?<Play size={14}/>:<Pause size={14}/>} {fallback?'Vista estática':motion?'Movimiento reducido':paused?'Activar animaciones':'Pausar animaciones'}</button><button type="button" disabled={fallback} onClick={()=>{controls.current.rotation-=0.2}} aria-label="Girar red a la izquierda"><RotateCcw size={14}/></button><button type="button" disabled={fallback} onClick={()=>{controls.current.rotation+=0.2}} aria-label="Girar red a la derecha"><RotateCw size={14}/></button><button type="button" disabled={fallback} onClick={()=>{controls.current.rotation=-0.22;controls.current.tilt=0.1}} aria-label="Restablecer vista de la red"><RotateCcw size={14}/></button><button type="button" disabled={Boolean(motion)||paused||fallback} onClick={()=>{controls.current.burst=1.5}}><Sparkles size={14}/>Amplificar señal</button></div><label className="neural-intensity">Intensidad<input disabled={fallback} type="range" min="0" max="1" step="0.05" value={energy} onChange={event=>setEnergy(Number(event.target.value))}/></label></div>
  </div>;
}

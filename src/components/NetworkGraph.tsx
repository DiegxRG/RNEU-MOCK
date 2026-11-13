import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { useReducedMotion } from 'motion/react';
import type { Network, Trace } from '../engine/network.ts';
import { number } from '../lib/utils.ts';

gsap.registerPlugin(MotionPathPlugin);
export interface NeuronSelection { layer: number; neuron: number }

export const NetworkGraph = memo(function NetworkGraph({ network, trace, selected, onSelect, features, running = false, playback = 0, speed = 1, onPhase }: {
  network: Network; trace: Trace; selected: NeuronSelection; onSelect: (value: NeuronSelection) => void; features: string[];
  running?: boolean; playback?: number; speed?: number; onPhase?: (phase: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const callback = useRef(onPhase); callback.current = onPhase;
  const previousPlayback=useRef(0);
  const reduced = useReducedMotion();
  const prefix = useId().replace(/:/g, '');
  const structure = network.sizes.join('-');
  const width = 900, height = Math.max(370, Math.max(...network.sizes) * 34 + 110);
  const x = (layer: number) => 78 + layer * (width - 156) / (network.sizes.length - 1);
  const y = (layer: number, neuron: number) => height / 2 + 10 + (neuron - (network.sizes[layer] - 1) / 2) * Math.min(66, (height - 150) / network.sizes[layer]);
  const edges = useMemo(() => network.sizes.slice(1).flatMap((count,l) => Array.from({length:count},(_,n) => Array.from({length:network.sizes[l]},(_,i) => ({
    id:`${l}-${n}-${i}`, layer:l, neuron:n, input:i,
    particle: (n * network.sizes[l] + i) % Math.max(1,Math.ceil(count * network.sizes[l] / 16)) === 0,
    path:`M ${x(l)+22} ${y(l,i)} C ${x(l)+78} ${y(l,i)}, ${x(l+1)-78} ${y(l+1,n)}, ${x(l+1)-22} ${y(l+1,n)}`,
  }))).flat()),[structure,height]);

  useEffect(() => {
    const element = svg.current;
    const manual=playback!==previousPlayback.current;previousPlayback.current=playback;
    if (!element || reduced || (!running && !manual)) return;
    const layerDuration = 0.8, depth = network.sizes.length - 1;
    const forwardEnd = depth * layerDuration;
    const reverseStart = forwardEnd + 0.9;
    const updateStart = reverseStart + forwardEnd + 0.45;
    const timeline = gsap.timeline({ repeat: running ? -1 : 0, repeatDelay: running ? 0.24 : 0 });
    timeline.call(() => callback.current?.(0), [], 0);
    element.querySelectorAll<SVGPathElement>('[data-edge-id]').forEach(path => {
      const id = path.dataset.edgeId!, layer = Number(path.dataset.layer);
      const forwardParticle = element.querySelector(`[data-forward="${id}"]`);
      const backwardParticle = element.querySelector(`[data-backward="${id}"]`);
      if (!forwardParticle || !backwardParticle) return;
      const options = { path, align: path, alignOrigin: [0.5,0.5], autoRotate: false };
      timeline.set(forwardParticle,{opacity:0},0).set(backwardParticle,{opacity:0},0);
      timeline.set(forwardParticle,{opacity:1},layer*layerDuration);
      timeline.fromTo(forwardParticle,{motionPath:{...options,start:0,end:0}},{motionPath:{...options,start:0,end:1},duration:layerDuration,ease:'none',immediateRender:false},layer*layerDuration);
      timeline.set(forwardParticle,{opacity:0},(layer+1)*layerDuration);
      const backTime = reverseStart + (depth-layer-1)*layerDuration;
      timeline.set(backwardParticle,{opacity:1},backTime);
      timeline.fromTo(backwardParticle,{motionPath:{...options,start:1,end:1}},{motionPath:{...options,start:1,end:0},duration:layerDuration,ease:'none',immediateRender:false},backTime);
      timeline.set(backwardParticle,{opacity:0},backTime+layerDuration);
      for (const [direction,start,reverse] of [['forward',layer*layerDuration,false],['backward',backTime,true]] as const) {
        const trails=element.querySelectorAll(`[data-trail-${direction}="${id}"]`);
        trails.forEach((trail,index)=>{
          const lag=(index+1)*0.035;
          timeline.set(trail,{opacity:0},0);
          timeline.set(trail,{opacity:0.48/(index+1)},start+lag);
          timeline.fromTo(trail,{motionPath:{...options,start:reverse?1:0,end:reverse?1:0}},{motionPath:{...options,start:reverse?1:0,end:reverse?0:1},duration:layerDuration,ease:'none',immediateRender:false},start+lag);
          timeline.to(trail,{opacity:0,duration:0.18},start+lag+layerDuration);
        });
      }
    });
    for(let layer=0;layer<network.sizes.length;layer++) {
      const nodes=element.querySelectorAll(`[data-glow-layer="${layer}"]`);
      timeline.fromTo(nodes,{opacity:0},{opacity:0.6,duration:0.15,repeat:1,yoyo:true,ease:'power1.out'},layer*layerDuration);
      const ripples=element.querySelectorAll(`[data-aura-layer="${layer}"]`);
      timeline.fromTo(ripples,{attr:{r:22},opacity:0.65},{attr:{r:58},opacity:0,duration:1.2,ease:'power2.out'},layer*layerDuration);
    }
    timeline.call(()=>callback.current?.(1),[],forwardEnd+0.03);
    timeline.call(()=>callback.current?.(2),[],reverseStart);
    timeline.call(()=>callback.current?.(3),[],updateStart);
    timeline.fromTo(element.querySelectorAll('[data-neuron-ring]'),{strokeOpacity:0.15},{strokeOpacity:0.8,duration:0.22,repeat:1,yoyo:true},updateStart);
    timeline.timeScale(speed);
    let visible = true;
    const updateVisibility = () => { if(document.hidden || !visible) timeline.pause(); else timeline.resume(); };
    const observer = new IntersectionObserver(entries => { visible=entries[0].isIntersecting;updateVisibility(); },{threshold:0.05});
    observer.observe(element); document.addEventListener('visibilitychange',updateVisibility); updateVisibility();
    return () => { observer.disconnect();document.removeEventListener('visibilitychange',updateVisibility);timeline.kill();gsap.set(element.querySelectorAll('[data-flow-particle], [data-glow-layer], [data-aura-layer]'),{opacity:0}); };
  },[structure,height,running,playback,speed,reduced]);

  return <div className="network-paper relative overflow-hidden">
    <div className="network-vignette" aria-hidden="true"/>
    <div className="network-canvas-scroll"><svg ref={svg} viewBox={`0 0 ${width} ${height+30}`} className="network-svg relative w-full" role="group" aria-label="Red neuronal interactiva con flujo de activaciones y gradientes">
      <defs><radialGradient id={`${prefix}-flow-blue`}><stop offset="0" stopColor="#e5f8ff" stopOpacity="1"/><stop offset="0.2" stopColor="#6b9dff" stopOpacity="0.9"/><stop offset="0.55" stopColor="#6288ff" stopOpacity="0.32"/><stop offset="1" stopColor="#6288ff" stopOpacity="0"/></radialGradient><radialGradient id={`${prefix}-flow-coral`}><stop offset="0" stopColor="#fff0d8"/><stop offset="0.2" stopColor="#f5a07d" stopOpacity="0.9"/><stop offset="0.55" stopColor="#f08b6d" stopOpacity="0.3"/><stop offset="1" stopColor="#f08b6d" stopOpacity="0"/></radialGradient><radialGradient id={`${prefix}-node`} cx="35%" cy="20%" r="90%"><stop offset="0" stopColor="white"/><stop offset="1" stopColor="#edf2ff"/></radialGradient><radialGradient id={`${prefix}-active`} cx="25%" cy="15%" r="100%"><stop offset="0" stopColor="#829aff"/><stop offset="1" stopColor="#4263eb"/></radialGradient><filter id={`${prefix}-glow`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {network.sizes.map((size,l)=><g key={`column-${l}`}><rect x={x(l)-46} y={70} width={92} height={height-100} rx={28} fill="white" fillOpacity={l===0||l===network.sizes.length-1?0.35:0.12} stroke="white" strokeOpacity={0.35}/><text x={x(l)} y={27} textAnchor="middle" className="graph-label">{l===0?'Entrada':l===network.sizes.length-1?'Predicción':`Capa oculta ${l}`}</text><text x={x(l)} y={47} textAnchor="middle" className="graph-subtitle">{l===0?`${size} variables`:l===network.sizes.length-1?'Sigmoid · 1 salida':`${size} neuronas · ${network.hiddenActivation}`}</text></g>)}
      {edges.map(edge=>{
        const weight=network.weights[edge.layer][edge.neuron][edge.input];
        const focus=selected.layer===edge.layer+1&&selected.neuron===edge.neuron;
        return <path key={edge.id} data-edge-id={edge.particle?edge.id:undefined} data-layer={edge.layer} d={edge.path} fill="none" stroke={weight>=0?'var(--connection-positive)':'var(--connection-negative)'} strokeWidth={Math.min(3.2,0.65+Math.abs(weight)*0.6)} opacity={focus?0.8:0.24}><title>{`Peso ${number(weight)}: capa ${edge.layer}, neurona ${edge.input+1} → capa ${edge.layer+1}, neurona ${edge.neuron+1}`}</title></path>;
      })}
      <g aria-hidden="true" pointerEvents="none">{edges.filter(edge=>edge.particle).map(edge=><g key={edge.id}><circle data-flow-particle="true" data-forward={edge.id} r="13" fill={`url(#${prefix}-flow-blue)`} opacity="0"/><circle data-flow-particle="true" data-backward={edge.id} r="13" fill={`url(#${prefix}-flow-coral)`} opacity="0"/>{[0,1,2,3].map(index=><g key={index}><circle data-flow-particle="true" data-trail-forward={edge.id} r={14+index*5} fill={`url(#${prefix}-flow-blue)`} opacity="0"/><circle data-flow-particle="true" data-trail-backward={edge.id} r={14+index*5} fill={`url(#${prefix}-flow-coral)`} opacity="0"/></g>)}</g>)}</g>
      {network.sizes.map((size,l)=><g key={l}>{Array.from({length:size},(_,n)=>{
        const active=selected.layer===l&&selected.neuron===n,value=trace.activations[l][n];
        return <g key={n} role="button" tabIndex={0} aria-label={`${l===0?'Entrada':'Capa '+l}, neurona ${n+1}, valor ${number(value)}`} aria-pressed={active} onClick={()=>onSelect({layer:l,neuron:n})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect({layer:l,neuron:n});}}} className="neuron">
          <circle data-aura-layer={l} cx={x(l)} cy={y(l,n)} r="22" fill={`url(#${prefix}-flow-blue)`} opacity="0"/><circle data-glow-layer={l} cx={x(l)} cy={y(l,n)} r={32} fill="var(--color-primary)" filter={`url(#${prefix}-glow)`} opacity="0"/>
          {active&&<circle cx={x(l)} cy={y(l,n)} r={29} fill="var(--color-primary)" opacity={0.1}/>}
          <circle data-neuron-ring="true" cx={x(l)} cy={y(l,n)} r={23} fill={`url(#${prefix}-${active?'active':'node'})`} stroke={active?'var(--color-primary)':'#aabce5'} strokeWidth={active?2:1.3}/>
          <path d={`M ${x(l)-12} ${y(l,n)-14} Q ${x(l)} ${y(l,n)-21} ${x(l)+12} ${y(l,n)-14}`} fill="none" stroke="white" strokeWidth="2" opacity={active?0.45:0.95}/>
          <text x={x(l)} y={y(l,n)+4} textAnchor="middle" fontSize={11} fontWeight={active?600:400} fill={active?'white':'var(--color-foreground)'} fontFamily="var(--font-mono)">{value.toFixed(2)}</text>
          {l===0&&<text x={x(l)-31} y={y(l,n)+4} textAnchor="end" className="graph-subtitle">{features[n]?.slice(0,8)}</text>}
        </g>;
      })}<text x={x(l)} y={height+6} textAnchor="middle" className="graph-subtitle">{l===0?'Muestra normalizada':l===network.sizes.length-1?'P(clase 1)':`Activaciones ${network.hiddenActivation}`}</text></g>)}
    </svg></div>
    <div className="network-legend"><span><i className="bg-primary"/>Activación / peso positivo</span><span><i className="bg-connection-negative"/>Gradiente / peso negativo</span><span className="ml-auto hidden sm:inline">{reduced?'Movimiento reducido':running?'Flujo ilustrado en vivo':'Selecciona una neurona'}</span></div>
  </div>;
});

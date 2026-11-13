import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export function NeuralBackdrop({paused}:{paused:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null),pause=useRef(paused);pause.current=paused;
  const reduced=useReducedMotion();
  useEffect(()=>{
    const element=canvas.current,context=element?.getContext('2d');if(!element||!context)return;
    let width=1,height=1,frame=0,last=0,time=0,seed=37,dirty=true;
    const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    const nodes=Array.from({length:62},()=>({x:random(),y:random(),phase:random()*Math.PI*2,drift:0.003+random()*0.005}));
    const resize=()=>{width=innerWidth;height=innerHeight;const pixel=Math.min(devicePixelRatio||1,1.5);element.width=Math.round(width*pixel);element.height=Math.round(height*pixel);context.setTransform(pixel,0,0,pixel,0,0);dirty=true;};
    const draw=()=>{
      context.clearRect(0,0,width,height);
      const points=nodes.map(n=>({x:(n.x+Math.sin(time*0.09+n.phase)*n.drift)*width,y:(n.y+Math.cos(time*0.07+n.phase)*n.drift)*height}));
      for(let i=0;i<points.length;i++){
        const a=points[i];
        for(let j=i+1;j<points.length;j++){
          const b=points[j],distance=Math.hypot(a.x-b.x,a.y-b.y),limit=Math.min(260,width*0.22);if(distance>limit)continue;
          context.strokeStyle=`rgba(100,145,240,${(1-distance/limit)*0.16})`;context.lineWidth=0.6;context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();
          if((i+j)%9===0){const p=(time*0.075+i*0.13)%1,x=a.x+(b.x-a.x)*p,y=a.y+(b.y-a.y)*p,glow=context.createRadialGradient(x,y,0,x,y,6);glow.addColorStop(0,'#80d4ff90');glow.addColorStop(1,'#80d4ff00');context.fillStyle=glow;context.fillRect(x-6,y-6,12,12);}
        }
        context.fillStyle='rgba(127,172,250,.32)';context.beginPath();context.arc(a.x,a.y,i%7===0?1.6:0.8,0,Math.PI*2);context.fill();
      }
    };
    const tick=(now:number)=>{if(now-last>33){const delta=Math.min((now-last)/1000,0.1);last=now;if(!document.hidden&&((!pause.current&&!reduced)||dirty)){if(!pause.current&&!reduced)time+=delta;draw();dirty=false;}}frame=requestAnimationFrame(tick)};
    resize();frame=requestAnimationFrame(tick);window.addEventListener('resize',resize);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize)};
  },[reduced]);
  return <canvas ref={canvas} className="neural-backdrop" aria-hidden="true"/>;
}

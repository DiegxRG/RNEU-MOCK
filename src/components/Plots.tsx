import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { gsap } from 'gsap';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Network, Sample } from '../engine/network.ts';
import { forward } from '../engine/network.ts';
import type { Standardizer } from '../engine/data.ts';
import type { Dataset, EpochRecord, Run } from '../domain/lab.ts';
import { executionCounts, histogram } from '../domain/statistics.ts';
import { number, percent } from '../lib/utils.ts';
import { Select } from './ui.tsx';

const axis = {tick:{fill:'var(--color-muted-foreground)',fontSize:10},tickLine:false,axisLine:false};
const tooltipStyle={borderRadius:14,border:'1px solid rgba(170,185,220,.5)',boxShadow:'0 12px 35px rgba(28,50,90,.12)',background:'rgba(255,255,255,.97)',fontSize:12};

export function DecisionPlot({ network, samples, normalizer, onPoint }: { network?: Network; samples: Sample[]; normalizer?: Standardizer; onPoint?: (inputs: number[]) => void }) {
  const canvasRef=useRef<HTMLCanvasElement>(null),frame=useRef<gsap.core.Tween|null>(null),painted=useRef<number[]>([]);
  const reduce=useReducedMotion();
  const [hover,setHover]=useState<Sample|null>(null);
  const bounds=useMemo(()=>[0,1].map(index=>{const values=samples.map(row=>row.inputs[index]);const min=Math.min(...values),max=Math.max(...values),padding=(max-min)*0.12||1;return[min-padding,max+padding];}),[samples]);
  const signature=JSON.stringify(bounds);
  const cells=32,size=360,pad=30,inner=size-2*pad;
  useEffect(()=>{
    const canvas=canvasRef.current,context=canvas?.getContext('2d');
    if(!canvas||!context||samples[0]?.inputs.length!==2)return;
    frame.current?.kill();
    const grid=Array.from({length:cells*cells},(_,index)=>{
      if(!network||!normalizer)return 0.5;
      const i=index%cells,j=Math.floor(index/cells);
      const point=[bounds[0][0]+(i+0.5)/cells*(bounds[0][1]-bounds[0][0]),bounds[1][0]+(j+0.5)/cells*(bounds[1][1]-bounds[1][0])];
      return forward(network,point.map((value,k)=>(value-normalizer.means[k])/normalizer.scales[k])).probability;
    });
    const from=painted.current.length===grid.length?[...painted.current]:grid.map(()=>0.5);
    const progress={value:reduce?1:0};
    const draw=()=>{
      context.setTransform(2,0,0,2,0,0);context.clearRect(0,0,size,size);
      context.fillStyle='rgba(247,250,255,.55)';context.fillRect(0,0,size,size);
      painted.current=grid.map((value,index)=>from[index]+(value-from[index])*progress.value);
      painted.current.forEach((probability,index)=>{
        const i=index%cells,j=Math.floor(index/cells),strength=Math.abs(probability-0.5)*0.56;
        context.fillStyle=probability>=0.5?`rgba(80,112,244,${0.025+strength})`:`rgba(225,130,103,${0.025+strength})`;
        context.fillRect(pad+i/cells*inner,size-pad-(j+1)/cells*inner,inner/cells+0.5,inner/cells+0.5);
      });
      const x=(value:number)=>pad+(value-bounds[0][0])/(bounds[0][1]-bounds[0][0])*inner;
      const y=(value:number)=>size-pad-(value-bounds[1][0])/(bounds[1][1]-bounds[1][0])*inner;
      context.strokeStyle='rgba(112,136,179,.2)';context.lineWidth=0.7;
      for(let tick=0;tick<=4;tick++){const p=pad+tick/4*inner;context.beginPath();context.moveTo(p,pad);context.lineTo(p,size-pad);context.moveTo(pad,p);context.lineTo(size-pad,p);context.stroke();}
      context.save();context.beginPath();context.rect(pad,pad,inner,inner);context.clip();
      context.strokeStyle='rgba(90,114,160,.4)';context.beginPath();context.moveTo(x(0),pad);context.lineTo(x(0),size-pad);context.moveTo(pad,y(0));context.lineTo(size-pad,y(0));context.stroke();
      for(const sample of samples){context.beginPath();context.arc(x(sample.inputs[0]),y(sample.inputs[1]),3.2,0,Math.PI*2);context.fillStyle=sample.target?'#4c6ef5':'#d88063';context.fill();context.strokeStyle='rgba(255,255,255,.9)';context.lineWidth=1;context.stroke();}
      context.restore();context.fillStyle='#66758e';context.font='11px Segoe UI';context.fillText('x₁',size-20,size-pad+4);context.fillText('x₂',pad-4,17);
      for(let tick=0;tick<=2;tick++){const t=tick/2;context.fillText((bounds[0][0]+t*(bounds[0][1]-bounds[0][0])).toFixed(1),pad+t*inner-9,size-10);}
    };
    draw();if(!reduce)frame.current=gsap.to(progress,{value:1,duration:0.26,ease:'power1.out',onUpdate:draw});
    return()=>{frame.current?.kill();};
  },[network,samples,normalizer,signature,reduce]);
  if(samples[0]?.inputs.length!==2)return <div className="chart-empty"><strong>{samples[0]?.inputs.length??0} variables en este dataset</strong><p>Consulta la distribución de variables para explorar datos de más de dos dimensiones.</p></div>;
  return <div className="decision-view"><canvas ref={canvasRef} width={720} height={720} role="img" aria-label={`Mapa de ${samples.length} muestras. Azul: clase 1. Coral: clase 0. El fondo representa la probabilidad calculada por la red.`} className={onPoint?'cursor-crosshair':''}
    onMouseLeave={()=>setHover(null)} onMouseMove={event=>{const r=event.currentTarget.getBoundingClientRect(),px=(event.clientX-r.left)/r.width*size,py=(event.clientY-r.top)/r.height*size;const point=samples.find(row=>Math.hypot(pad+(row.inputs[0]-bounds[0][0])/(bounds[0][1]-bounds[0][0])*inner-px,size-pad-(row.inputs[1]-bounds[1][0])/(bounds[1][1]-bounds[1][0])*inner-py)<8);setHover(point??null);}}
    onClick={event=>{if(!onPoint)return;const r=event.currentTarget.getBoundingClientRect(),px=(event.clientX-r.left)/r.width*size,py=(event.clientY-r.top)/r.height*size;onPoint([bounds[0][0]+Math.max(0,Math.min(1,(px-pad)/inner))*(bounds[0][1]-bounds[0][0]),bounds[1][0]+Math.max(0,Math.min(1,(size-pad-py)/inner))*(bounds[1][1]-bounds[1][0])]);}}/>
    {hover&&<div className="plot-point-tooltip"><strong>Clase {hover.target}</strong><span>x₁ {number(hover.inputs[0],3)} · x₂ {number(hover.inputs[1],3)}</span></div>}
    <div className="chart-legend"><span><i className="bg-connection-negative"/>Clase 0</span><span><i className="bg-primary"/>Clase 1</span><span className="ml-auto text-[10px]">{samples.length} muestras</span></div>
  </div>;
}

function LearningChart({ history, mode='loss' }: {history:EpochRecord[];mode?:'loss'|'accuracy'}) {
  const reduce=useReducedMotion(),id=useId().replace(/:/g,'');
  const [inspected,setInspected]=useState<number|null>(null);
  const sample=history[Math.min(inspected??history.length-1,history.length-1)];
  const isAccuracy=mode==='accuracy';
  if(!history.length)return <div className="chart-empty"><span className="chart-empty-wave" aria-hidden="true">⌁</span><strong>Esperando la primera época</strong><p>Entrena la red para ver cómo evolucionan {isAccuracy?'los aciertos':'los errores'}.</p></div>;
  return <div className="learning-chart"><div className="chart-frame" role="img" aria-label={`${isAccuracy?'Exactitud':'Pérdida'} de entrenamiento y validación. ${history.length} registros. Última época ${history.at(-1)!.epoch}.`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><ComposedChart data={history} margin={{top:14,right:10,left:-14,bottom:2}} accessibilityLayer>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.2}/><stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/>
      <XAxis dataKey="epoch" {...axis} type="number" domain={[0,'dataMax']} tickCount={5} minTickGap={25}/>
      <YAxis {...axis} width={47} tickCount={4} domain={isAccuracy?[0,1]:[0,'auto']} tickFormatter={value=>isAccuracy?`${Math.round(value*100)}%`:Number(value).toFixed(2)}/>
      <Tooltip contentStyle={tooltipStyle} labelFormatter={value=>`Época ${value}`} formatter={(value,name)=>[isAccuracy?percent(Number(value)):number(Number(value)),String(name)]}/>
      <Area type="monotone" dataKey={isAccuracy?'trainAccuracy':'trainLoss'} fill={`url(#${id}-fill)`} stroke="none" isAnimationActive={false} tooltipType="none"/>
      <Line type="monotone" dataKey={isAccuracy?'trainAccuracy':'trainLoss'} name="Entrenamiento" stroke="var(--chart-blue)" strokeWidth={2.5} dot={history.length<2?{r:3}:false} activeDot={{r:5,strokeWidth:3,stroke:'white'}} isAnimationActive={!reduce&&history.length<3} animationDuration={400}/>
      <Line type="monotone" dataKey={isAccuracy?'validationAccuracy':'validationLoss'} name="Validación" stroke="var(--chart-coral)" strokeWidth={2.2} strokeDasharray="5 4" dot={false} activeDot={{r:5,strokeWidth:3,stroke:'white'}} isAnimationActive={false}/>
    </ComposedChart></ResponsiveContainer>
  </div><div className="chart-legend"><span><i className="bg-primary"/>Entrenamiento</span><span><i className="border-t-2 border-dashed border-connection-negative bg-transparent!"/>Validación</span></div>
  {history.length>1&&<div className="epoch-scrubber"><label htmlFor={`${id}-epoch`}>Época {sample?.epoch}</label><input id={`${id}-epoch`} aria-label="Inspeccionar época del gráfico" type="range" min={0} max={history.length-1} value={inspected??history.length-1} onChange={event=>setInspected(Number(event.target.value))}/><span className="font-mono">{sample?isAccuracy?percent(sample.validationAccuracy):number(sample.validationLoss,3):'—'}</span><button type="button" onClick={()=>setInspected(null)} aria-pressed={inspected===null} className={inspected===null?'text-success':'text-muted-foreground'}>En vivo</button></div>}
  </div>;
}
export function LossChart({history}:{history:EpochRecord[]}){return <LearningChart history={history}/>;}
export function AccuracyChart({history}:{history:EpochRecord[]}){return <LearningChart history={history} mode="accuracy"/>;}

export function RunStatusChart({runs}:{runs:Run[]}) {
  const counts=executionCounts(runs),reduce=useReducedMotion();
  return <div className="status-chart-layout"><div className="donut-frame" role="img" aria-label={counts.map(item=>`${item.name}: ${item.value}`).join(', ')}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={runs.length?counts.filter(item=>item.value):[{name:'Sin ejecuciones',value:1,color:'var(--chart-grid)'}]} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="86%" stroke="none" paddingAngle={runs.length?4:0} isAnimationActive={!reduce} animationDuration={550}>{(runs.length?counts.filter(item=>item.value):[{color:'var(--chart-grid)'}]).map((item,index)=><Cell key={index} fill={item.color}/>)}</Pie>{Boolean(runs.length)&&<Tooltip contentStyle={tooltipStyle}/>}<text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="var(--color-foreground)" fontSize="30" fontWeight="600">{runs.length}</text><text x="50%" y="61%" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="11">ejecuciones</text></PieChart></ResponsiveContainer></div><div className="space-y-3">{counts.map(item=><div key={item.name} className="flex items-center gap-2 text-xs"><i className="h-2 w-2 rounded-full" style={{background:item.color}}/><span className="flex-1 text-muted-foreground">{item.name}</span><strong className="font-mono">{item.value}</strong></div>)}</div></div>;
}

export function ClassBalanceChart({dataset}:{dataset:Dataset}) {
  const reduce=useReducedMotion();
  const data=[0,1].map(target=>({name:dataset.labels[target],count:dataset.rows.filter(row=>row.target===target).length}));
  return <div className="small-chart-frame" role="img" aria-label={data.map(item=>`${item.name}: ${item.count}`).join(', ')}><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} margin={{top:12,left:-20,right:12,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" {...axis}/><YAxis {...axis} allowDecimals={false}/><Tooltip contentStyle={tooltipStyle} formatter={value=>[value,'Muestras']}/><Bar dataKey="count" radius={[8,8,3,3]} maxBarSize={70} isAnimationActive={!reduce} animationDuration={500}><Cell fill="var(--chart-coral)"/><Cell fill="var(--chart-blue)"/></Bar></BarChart></ResponsiveContainer></div>;
}

export function FeatureHistogram({dataset}:{dataset:Dataset}) {
  const [feature,setFeature]=useState(0);const valid=Math.min(feature,dataset.features.length-1);const reduce=useReducedMotion();
  const data=useMemo(()=>histogram(dataset.rows.map(row=>row.inputs[valid]),10).map(bin=>({...bin,label:bin.center.toFixed(1),range:`${bin.lower.toFixed(2)} a ${bin.upper.toFixed(2)}`})),[dataset,valid]);
  return <div><Select aria-label="Variable del histograma" value={valid} onChange={event=>setFeature(Number(event.target.value))} className="mb-2 max-w-52">{dataset.features.map((name,index)=><option key={index} value={index}>{name}</option>)}</Select><div className="small-chart-frame" role="img" aria-label={`Histograma de ${dataset.features[valid]} con ${dataset.rows.length} muestras y 10 intervalos.`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} barCategoryGap={2} margin={{top:10,left:-20,right:12,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="label" {...axis} minTickGap={20}/><YAxis {...axis} allowDecimals={false}/><Tooltip contentStyle={tooltipStyle} labelFormatter={(_,payload)=>payload[0]?.payload.range??''} formatter={value=>[value,'Muestras']}/><Bar dataKey="count" fill="var(--chart-blue)" radius={[5,5,0,0]} isAnimationActive={!reduce} animationDuration={450}/></BarChart></ResponsiveContainer></div></div>;
}

export function WeightHistogram({network}:{network:Network}) {
  const reduce=useReducedMotion(),values=network.weights.flat(2);
  const data=histogram(values,12).map(bin=>({...bin,label:bin.center.toFixed(1)}));
  return <div className="small-chart-frame" role="img" aria-label={`Distribución de ${values.length} pesos calculados en la red.`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} barCategoryGap={2} margin={{top:10,left:-20,right:12,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="label" {...axis} minTickGap={20}/><YAxis {...axis} allowDecimals={false}/><Tooltip contentStyle={tooltipStyle} labelFormatter={(_,payload)=>{const bin=payload[0]?.payload;return bin?`${bin.lower.toFixed(2)} a ${bin.upper.toFixed(2)}`:''}} formatter={value=>[value,'Pesos']}/><Bar dataKey="count" radius={[4,4,0,0]} isAnimationActive={!reduce} animationDuration={200}>{data.map((bin,index)=><Cell key={index} fill={bin.center<0?'var(--chart-coral)':'var(--chart-blue)'}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}

export function ExperimentChart({runs}:{runs:Run[]}) {
  const reduce=useReducedMotion();const data=runs.filter(run=>run.status==='completed').slice(0,8).reverse().map(run=>({name:run.name,accuracy:(run.testMetrics?.accuracy??0)*100}));
  if(!data.length)return <div className="chart-empty"><strong>Compara tus próximos resultados</strong><p>Las ejecuciones completadas aparecerán aquí.</p></div>;
  return <div className="chart-frame" role="img" aria-label="Exactitud de prueba de los últimos ocho experimentos completados."><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} margin={{top:10,left:-10,right:10,bottom:10}} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" {...axis} tickFormatter={label=>String(label).replace('Experimento','Exp.')}/><YAxis {...axis} domain={[0,100]} tickFormatter={value=>`${value}%`}/><Tooltip contentStyle={tooltipStyle} formatter={value=>[`${Number(value).toFixed(1)} %`,'Exactitud de prueba']}/><Bar dataKey="accuracy" fill="var(--chart-blue)" radius={[7,7,2,2]} maxBarSize={45} isAnimationActive={!reduce} animationDuration={500}/></BarChart></ResponsiveContainer></div>;
}

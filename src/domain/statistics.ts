import type { Run } from './lab.ts';

export function histogram(values: readonly number[], bins = 10) {
  if (!Number.isInteger(bins) || bins < 1 || bins > 40) throw new Error('Número de intervalos no válido.');
  if (values.some(value => !Number.isFinite(value))) throw new Error('El histograma requiere valores finitos.');
  if (!values.length) return [];
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { const padding = Math.max(0.5, Math.abs(min) * 0.1); min -= padding; max += padding; }
  const width = (max - min) / bins;
  const result = Array.from({length:bins},(_,index)=>({ index, lower:min+index*width, upper:min+(index+1)*width, center:min+(index+0.5)*width, count:0 }));
  values.forEach(value=>result[Math.min(bins-1,Math.max(0,Math.floor((value-min)/width)))].count++);
  return result;
}

export function executionCounts(runs: readonly Pick<Run,'status'>[]) {
  return [
    {name:'Completados',value:runs.filter(run=>run.status==='completed').length,color:'var(--chart-green)'},
    {name:'En curso',value:runs.filter(run=>['running','preparing','queued','pausing'].includes(run.status)).length,color:'var(--chart-blue)'},
    {name:'Pausados',value:runs.filter(run=>run.status==='paused').length,color:'var(--chart-amber)'},
    {name:'Cancelados',value:runs.filter(run=>run.status==='cancelled').length,color:'var(--chart-muted)'},
    {name:'Fallidos',value:runs.filter(run=>run.status==='failed').length,color:'var(--chart-coral)'},
  ];
}

/** Positive class is class 1. Undefined ratios remain null, rather than fabricated zeroes. */
export function classificationReport(matrix: [[number,number],[number,number]]) {
  const [[tn,fp],[fn,tp]]=matrix;
  const ratio=(numerator:number,denominator:number)=>denominator?numerator/denominator:null;
  return {
    precision:ratio(tp,tp+fp),
    recall:ratio(tp,tp+fn),
    f1:ratio(2*tp,2*tp+fp+fn),
    specificity:ratio(tn,tn+fp),
  };
}

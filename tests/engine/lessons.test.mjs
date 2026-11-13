import test from 'node:test';
import assert from 'node:assert/strict';
import { convolve, recurrentStates, adversarialRound, adversarialMetrics } from '../../src/domain/lessons.ts';
import { makeNeuralGeometry, projectNeuralPoint, signalPoint, signalProgress, signalCycle, sceneLayers } from '../../src/visuals/neural-scene.ts';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('editable convolution agrees with the nine manual products and preserves its input',()=>{
  const image=[[1,2,3],[4,5,6],[7,8,9]],kernel=[[-1,0,1],[-1,0,1],[-1,0,1]],before=structuredClone(image);
  assert.deepEqual(convolve(image,kernel),[[6]]);assert.deepEqual(image,before);
  assert.deepEqual(convolve([[1,0,1],[0,1,0],[1,0,1]],[[1,0],[0,1]]),[[2,0],[0,2]]);
});
test('zero memory removes dependence on preceding sequence values',()=>{
  const a=recurrentStates([0.8,-0.3,0.5],0),b=recurrentStates([-0.8,-0.3,0.5],0);
  close(a[2],b[2]);close(a[3],b[3]);close(a[3],Math.tanh(0.8*0.5+0.1));
  assert.notEqual(recurrentStates([0.8,-0.3,0.5],0.8)[3],recurrentStates([-0.8,-0.3,0.5],0.8)[3]);
});
test('the scalar adversarial round matches finite differences for both alternating objectives',()=>{
  const state={theta:-0.5,weight:0.8,bias:0,round:0},rate=0.18,eps=1e-5,next=adversarialRound(state,rate);
  for(const key of ['weight','bias']) {
    const a=adversarialMetrics({...state,[key]:state[key]+eps}).discriminatorLoss,b=adversarialMetrics({...state,[key]:state[key]-eps}).discriminatorLoss;
    close(next[key],state[key]-rate*(a-b)/(2*eps));
  }
  const fixed={...next,theta:state.theta};
  const a=adversarialMetrics({...fixed,theta:state.theta+eps}).generatorLoss,b=adversarialMetrics({...fixed,theta:state.theta-eps}).generatorLoss;
  close(next.theta,state.theta-rate*(a-b)/(2*eps));assert.equal(next.round,1);
});
test('the illustrative adversarial duel stays finite over the full 200-round lesson',()=>{
  let state={theta:-0.5,weight:0.8,bias:0,round:0};for(let i=0;i<200;i++)state=adversarialRound(state);
  const metrics=adversarialMetrics(state);assert.equal(state.round,200);
  assert.ok(Number.isFinite(metrics.discriminatorLoss)&&Number.isFinite(metrics.generatorLoss));
  assert.ok(metrics.fake.every(value=>value>=-1&&value<=1));
});
test('hero geometry represents five feedforward layers with 21 neurons and 90 connections',()=>{
  const scene=makeNeuralGeometry();assert.equal(scene.positions.length,scene.colors.length);assert.equal(scene.lines.length,scene.lineColors.length);
  assert.equal(scene.cores.length/3,21);assert.equal(scene.paths.length,90);assert.deepEqual(scene.nodes.map(layer=>layer.length),sceneLayers);
  assert.ok(scene.positions.every(Number.isFinite));assert.ok(scene.colors.every(value=>value>=0&&value<=1.001));
  assert.ok(scene.paths.every(path=>path.to[0]>path.from[0]));
  for(const path of scene.paths){assert.deepEqual(signalPoint(path,0),path.from);signalPoint(path,1).forEach((value,i)=>close(value,path.to[i]));}
});
test('network rotation changes perspective depth and the mobile projection stays in frame',()=>{
  const a=projectNeuralPoint([0.5,0.3,0.8],0,0.15,1),b=projectNeuralPoint([0.5,0.3,0.8],Math.PI/2,0.15,1);
  assert.notEqual(a[0],b[0]);assert.notEqual(a[2],b[2]);assert.ok([...a,...b].every(Number.isFinite));
  for(const layer of makeNeuralGeometry().nodes)for(const node of layer)assert.ok(Math.abs(projectNeuralPoint(node,-0.22,0.1,0.9)[0])<1);
});
test('illustrated signals advance through successive layers and reverse for backpropagation',()=>{
  assert.equal(signalCycle(0.3).phase,0);assert.equal(signalProgress(0.3,0).visible,true);assert.equal(signalProgress(0.3,1).visible,false);
  const backTime=4*0.85+0.9+0.3;
  assert.equal(signalCycle(backTime).phase,2);assert.equal(signalProgress(backTime,3).reverse,true);assert.equal(signalProgress(backTime,3).visible,true);assert.equal(signalProgress(backTime,0).visible,false);
  assert.ok(signalProgress(backTime,3).progress>signalProgress(backTime+0.1,3).progress);
  assert.equal(signalProgress(3.8,0).visible,false);assert.equal(signalCycle(signalCycle(0).total+0.3).phase,0);
});

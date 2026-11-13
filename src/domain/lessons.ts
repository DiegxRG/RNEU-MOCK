import { binaryLoss, sigmoid } from '../engine/network.ts';

export function convolve(input:number[][],kernel:number[][]) {
  return Array.from({length:input.length-kernel.length+1},(_,r)=>Array.from({length:input[0].length-kernel[0].length+1},(_,c)=>kernel.reduce((sum,row,i)=>sum+row.reduce((acc,value,j)=>acc+value*input[r+i][c+j],0),0)));
}
export function recurrentStates(sequence:readonly number[],memory:number) {
  const states=[0];sequence.forEach(value=>states.push(Math.tanh(0.8*value+memory*states.at(-1)!+0.1)));return states;
}
export interface AdversarialState {theta:number;weight:number;bias:number;round:number}
export const latent=[-0.8,-0.4,0,0.4,0.8];
export const realSamples=[0.25,0.4,0.55,0.7,0.85];
export function adversarialMetrics(state:AdversarialState) {
  const fake=latent.map(z=>Math.tanh(z+state.theta));
  const discriminate=(x:number)=>sigmoid(state.weight*x+state.bias);
  return {fake,fakeScore:fake.map(discriminate),
    discriminatorLoss:(realSamples.reduce((sum,x)=>sum+binaryLoss(state.weight*x+state.bias,1),0)+fake.reduce((sum,x)=>sum+binaryLoss(state.weight*x+state.bias,0),0))/(2*fake.length),
    generatorLoss:fake.reduce((sum,x)=>sum+binaryLoss(state.weight*x+state.bias,1),0)/fake.length};
}
/** Alternating SGD for a scalar generator tanh(z+theta) and a logistic discriminator. */
export function adversarialRound(state:AdversarialState,rate=0.18):AdversarialState {
  const fake=latent.map(z=>Math.tanh(z+state.theta));let dw=0,db=0;
  for(const x of realSamples){const d=sigmoid(state.weight*x+state.bias)-1;dw+=d*x;db+=d;}
  for(const x of fake){const d=sigmoid(state.weight*x+state.bias);dw+=d*x;db+=d;}
  const weight=state.weight-rate*dw/(2*fake.length),bias=state.bias-rate*db/(2*fake.length);
  const dt=fake.reduce((sum,x)=>sum+(sigmoid(weight*x+bias)-1)*weight*(1-x*x),0)/fake.length;
  return {weight,bias,theta:state.theta-rate*dt,round:state.round+1};
}

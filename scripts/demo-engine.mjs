import { createNetwork, trainEpoch, evaluate, parameterCount } from '../src/engine/network.ts';
import { createRandom } from '../src/engine/random.ts';
import { generateXor, stratifiedSplit, fitStandardizer, transform } from '../src/engine/data.ts';

const split = stratifiedSplit(generateXor());
const normalizer = fitStandardizer(split.train);
const train = transform(split.train, normalizer);
const validation = transform(split.validation, normalizer);
let network = createNetwork([2,4,4,1],11);
const random=createRandom(151);
console.log('NeuroLab | XOR sintético | 37 parámetros | SGD | cálculo local');
const history=[];
for(let epoch=0;epoch<=450;epoch++){
  if(epoch>0) network=trainEpoch(network,train,{learningRate:0.1,batchSize:16,random});
  if(epoch%50===0){const t=evaluate(network,train),v=evaluate(network,validation);history.push({epoch,trainLoss:t.loss.toFixed(5),validationLoss:v.loss.toFixed(5),validationAccuracy:(100*v.accuracy).toFixed(1)+'%'});}
}
console.table(history);
console.log(JSON.stringify({parameters:parameterCount(network),test:evaluate(network,transform(split.test,normalizer))},null,2));

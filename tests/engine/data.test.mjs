import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../../src/engine/random.ts';
import { generateXor, stratifiedSplit, fitStandardizer, transform } from '../../src/engine/data.ts';

test('semillas y restauración del generador producen secuencias reproducibles', () => {
  assert.deepEqual(generateXor(40,1), generateXor(40,1));
  assert.notDeepEqual(generateXor(40,1), generateXor(40,2));
  const random=createRandom(12);
  random.next(); random.next();
  const restored=createRandom(random.state);
  assert.deepEqual(Array.from({length:10},()=>random.next()), Array.from({length:10},()=>restored.next()));
  assert.throws(()=>createRandom(-1));
});

test('las particiones son disjuntas, completas y estratificadas', () => {
  const data=generateXor();
  const split=stratifiedSplit(data);
  assert.deepEqual([split.train.length,split.validation.length,split.test.length],[168,36,36]);
  const ids=Object.values(split).flat().map(row=>row.id);
  assert.equal(new Set(ids).size,data.length);
  for(const group of Object.values(split)) assert.equal(group.filter(row=>row.target===1).length,group.length/2);
  assert.deepEqual(split,stratifiedSplit(data));
  assert.throws(()=>stratifiedSplit([...data,data[0]]),/únicos/);
  assert.throws(()=>stratifiedSplit(data,71,[1,0,0]));
});

test('el escalado se ajusta con train y no se reajusta con el valor extremo de test', () => {
  const train=[{id:'a',inputs:[0,7],target:0},{id:'b',inputs:[2,7],target:1}];
  const standardizer=fitStandardizer(train);
  assert.deepEqual(standardizer,{means:[1,7],scales:[1,1]});
  const testData=[{id:'test',inputs:[101,7],target:1}];
  assert.deepEqual(transform(testData,standardizer)[0].inputs,[100,0]);
  assert.deepEqual(standardizer,{means:[1,7],scales:[1,1]});
  assert.deepEqual(train[0].inputs,[0,7]);
  assert.throws(()=>transform([{id:'bad',inputs:[1],target:0}],standardizer));
  assert.throws(()=>fitStandardizer([]));
  assert.throws(()=>fitStandardizer([{id:'bad',inputs:[Infinity],target:0}]));
});

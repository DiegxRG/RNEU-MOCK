import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { trainEpoch, evaluate, createNetwork } from '../../src/engine/network.ts';
import { createRandom } from '../../src/engine/random.ts';
import { generateXor, stratifiedSplit, fitStandardizer, transform } from '../../src/engine/data.ts';

// Execute the actual worker with a deterministic event queue in place of wall-clock timers.
const source = fs.readFileSync(new URL('../../src/workers/training.worker.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  .replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};?\s*$/gm, '');
function workerHarness() {
  const tasks = [], messages = [], delays=[];
  const self = {postMessage:message=>messages.push(structuredClone(message))};
  vm.runInNewContext(compiled, {self, trainEpoch, evaluate, createRandom, transform, setTimeout:(task,delay)=>{tasks.push(task);delays.push(delay)}});
  return {messages, delays, send:data=>self.onmessage({data}), tick:()=>tasks.shift()?.(), flush:()=>{let cap=100;while(tasks.length&&cap--)tasks.shift()();assert.ok(cap>0,'worker must terminate');}};
}
function fixture() {
  const split = stratifiedSplit(generateXor(48,41),71);
  return {id:'run',epoch:0,config:{epochs:21,learningRate:0.1,batchSize:8},split,normalizer:fitStandardizer(split.train),network:createNetwork([2,4,1],11,'tanh'),randomState:151};
}
function execute(speed) {
  const worker=workerHarness();worker.send({type:'start',run:fixture(),speed});worker.flush();
  return worker.messages;
}

test('playback speed changes checkpoint cadence without changing training results', () => {
  const slow=execute(0.5), normal=execute(1), fast=execute(4);
  for(const messages of [execute(0.25),slow,normal,execute(2),fast]) {
    assert.equal(messages.at(-1).status,'completed');
    assert.equal(messages.at(-1).epoch,21);
    assert.deepEqual(messages.at(-1).network,normal.at(-1).network);
    assert.equal(messages.at(-1).randomState,normal.at(-1).randomState);
    assert.deepEqual(messages.flatMap(message=>message.metrics),normal.flatMap(message=>message.metrics));
  }
  assert.ok(slow.length>normal.length && normal.length>fast.length);
});

test('guided playback defaults to one epoch every 200 ms, with an explicit slower mode',()=>{
  const guided=workerHarness();guided.send({type:'start',run:fixture()});guided.tick();
  assert.equal(guided.messages[0].epoch,1);assert.equal(guided.delays[1],200);
  const slow=workerHarness();slow.send({type:'start',run:fixture(),speed:0.25});slow.tick();
  assert.equal(slow.messages[0].epoch,1);assert.equal(slow.delays[1],400);
});

test('single-epoch pause and resume preserve the uninterrupted random sequence', () => {
  const worker=workerHarness(),run=fixture();
  worker.send({type:'start',run,single:true,speed:4});worker.flush();
  const checkpoint=worker.messages.at(-1);
  assert.equal(checkpoint.status,'paused');assert.equal(checkpoint.epoch,1);
  worker.send({type:'start',run:{...run,...checkpoint},speed:4});worker.flush();
  assert.deepEqual(worker.messages.at(-1).network,execute(4).at(-1).network);
});

test('pause and cancel stop between checkpoints without performing extra epochs', () => {
  for(const action of ['pause','cancel']) {
    const worker=workerHarness();worker.send({type:'start',run:fixture(),speed:1});worker.tick();
    const epoch=worker.messages.at(-1).epoch;
    worker.send({type:action});worker.flush();
    assert.equal(worker.messages.at(-1).epoch,epoch);
    assert.equal(worker.messages.at(-1).status,action==='pause'?'paused':'cancelled');
    assert.equal(worker.messages.at(-1).metrics.length,0);
  }
});

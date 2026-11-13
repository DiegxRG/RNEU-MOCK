import { trainEpoch, evaluate } from '../engine/network.ts';
import { createRandom } from '../engine/random.ts';
import { transform } from '../engine/data.ts';
import type { Run, EpochRecord } from '../domain/lab.ts';

let generation = 0;
let pause = false;
let cancel = false;
let speed = 1;
self.onmessage = event => {
  if (event.data.type === 'pause') { pause = true; return; }
  if (event.data.type === 'cancel') { cancel = true; return; }
  if (event.data.type === 'speed') { if([0.25,0.5,1,2,4].includes(event.data.speed))speed=event.data.speed; return; }
  if (event.data.type !== 'start') return;
  const run: Run = event.data.run;
  const single = event.data.single === true;
  speed = [0.25,0.5,1,2,4].includes(event.data.speed)?event.data.speed:0.5;
  const token = ++generation;
  pause = false; cancel = false;
  let network = run.network, epoch = run.epoch;
  const random = createRandom(run.randomState);
  const train = transform(run.split.train, run.normalizer), validation = transform(run.split.validation, run.normalizer);
  const tick = () => {
    if (token !== generation) return;
    try {
      const metrics: EpochRecord[] = [];
      for (let count = 0; count < (single ? 1 : speed>=2?4:speed>=1?2:1) && epoch < run.config.epochs && !cancel && !pause; count++) {
        network = trainEpoch(network, train, { ...run.config, random }); epoch++;
        const t = evaluate(network, train), v = evaluate(network, validation);
        metrics.push({ epoch, trainLoss: t.loss, validationLoss: v.loss, trainAccuracy: t.accuracy, validationAccuracy: v.accuracy });
      }
      const status = cancel ? 'cancelled' : epoch >= run.config.epochs ? 'completed' : pause || single ? 'paused' : 'running';
      self.postMessage({ type: 'checkpoint', id: run.id, network, epoch, randomState: random.state, metrics, status });
      if (status === 'running') setTimeout(tick, Math.round(100 / speed));
    } catch (error) { self.postMessage({ type: 'error', id: run.id, error: error instanceof Error ? error.message : 'No se pudo completar el cálculo.' }); }
  };
  setTimeout(tick, 0);
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, cloneNetwork, forward, binaryLoss, gradients, trainEpoch, evaluate, parameterCount, validateNetwork } from '../../src/engine/network.ts';
import { createRandom } from '../../src/engine/random.ts';
import { generateXor, stratifiedSplit, fitStandardizer, transform } from '../../src/engine/data.ts';

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('una neurona reproduce el cálculo manual y la actualización SGD', () => {
  const network = createNetwork([2, 1]);
  network.weights = [[[0.5, -0.4]]];
  network.biases = [[0.1]];
  const sample = { id: 'manual', inputs: [0.8, 0.3], target: 1 };
  const before = structuredClone(network);
  const trace = forward(network, sample.inputs);
  close(trace.logit, 0.38);
  close(trace.probability, 0.5938731029341427);
  close(binaryLoss(trace.logit, 1), 0.5210896138659374);
  const gradient = gradients(network, sample);
  close(gradient.weights[0][0][0], -0.3249015176526858);
  close(gradient.biases[0][0], -0.40612689706585725);
  const next = trainEpoch(network, [sample], { learningRate: 0.1, batchSize: 1, random: createRandom(0) });
  close(next.weights[0][0][0], 0.5324901517652686);
  close(next.weights[0][0][1], -0.3878161930880243);
  close(next.biases[0][0], 0.14061268970658575);
  close(binaryLoss(forward(next, sample.inputs).logit, 1), 0.49314773845653276);
  assert.deepEqual(network, before, 'la entrada no se modifica');
});

for (const activation of ['tanh', 'sigmoid', 'relu']) {
  test(`backpropagation ${activation} coincide con diferencias finitas en cada parámetro`, () => {
    const network = createNetwork([2, 3, 2, 1], 101, activation);
    network.biases = network.biases.map(layer => layer.map(() => 0.37));
    const sample = { id: 'gradient', inputs: [0.2, -0.3], target: 1 };
    const analytic = gradients(network, sample);
    const epsilon = 1e-6;
    const loss = model => binaryLoss(forward(model, sample.inputs).logit, sample.target);
    for (let l = 0; l < network.weights.length; l++) {
      for (let n = 0; n < network.weights[l].length; n++) {
        for (let i = 0; i < network.weights[l][n].length; i++) {
          const plus = cloneNetwork(network), minus = cloneNetwork(network);
          plus.weights[l][n][i] += epsilon;
          minus.weights[l][n][i] -= epsilon;
          close(analytic.weights[l][n][i], (loss(plus) - loss(minus)) / (2 * epsilon), 1e-7);
        }
        const plus = cloneNetwork(network), minus = cloneNetwork(network);
        plus.biases[l][n] += epsilon;
        minus.biases[l][n] -= epsilon;
        close(analytic.biases[l][n], (loss(plus) - loss(minus)) / (2 * epsilon), 1e-7);
      }
    }
  });
}

test('BCE y sigmoid permanecen finitos con logits extremos', () => {
  close(binaryLoss(1000, 0), 1000);
  close(binaryLoss(-1000, 1), 1000);
  close(binaryLoss(1000, 1), 0);
  close(binaryLoss(-1000, 0), 0);
  assert.throws(() => binaryLoss(Infinity, 1), /finito/);
  assert.throws(() => binaryLoss(0, 2), /objetivo/);
});

test('el gradiente de lote se promedia una sola vez', () => {
  const network = createNetwork([2, 2, 1]);
  const sample = { id: 'a', inputs: [0.1, 0.6], target: 0 };
  const one = trainEpoch(network, [sample], { learningRate: 0.1, batchSize: 2, random: createRandom(1) });
  const duplicate = trainEpoch(network, [sample, {...sample, id:'b'}], { learningRate: 0.1, batchSize: 2, random: createRandom(1) });
  assert.deepEqual(one, duplicate);
  assert.equal(parameterCount(createNetwork([2, 4, 4, 1])), 37);
});

test('arquitecturas y entradas inválidas fallan de forma controlada', () => {
  assert.throws(() => createNetwork([2, 0, 1]));
  assert.throws(() => createNetwork([2, 2]));
  assert.throws(() => forward(createNetwork([2, 1]), [NaN, 0]));
  assert.throws(() => forward(createNetwork([2, 1]), [1]));
  const broken = createNetwork([2, 1]);
  broken.weights[0][0].pop();
  assert.throws(() => validateNetwork(broken));
  for (const learningRate of [0, -1, NaN, 2]) {
    assert.throws(() => trainEpoch(createNetwork([2, 1]), generateXor(40), { learningRate, batchSize: 1, random: createRandom(1) }));
  }
});

test('XOR aprende usando exclusivamente entrenamiento y generaliza a datos retenidos', () => {
  const split = stratifiedSplit(generateXor());
  const scale = fitStandardizer(split.train);
  const train = transform(split.train, scale), validation = transform(split.validation, scale);
  const heldout = transform(split.test, scale);
  let network = createNetwork([2, 4, 4, 1], 11);
  const initial = evaluate(network, validation);
  const random = createRandom(151);
  for (let epoch = 0; epoch < 450; epoch++) network = trainEpoch(network, train, { learningRate: 0.1, batchSize: 16, random });
  const final = evaluate(network, validation);
  assert.ok(final.loss < initial.loss * 0.4, `${initial.loss} -> ${final.loss}`);
  assert.ok(final.accuracy >= 0.9);
  const result = evaluate(network, heldout);
  assert.ok(result.accuracy >= 0.9);
  assert.equal(result.confusion.flat().reduce((a,b) => a+b,0), heldout.length);
});

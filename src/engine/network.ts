import { createRandom, shuffle, type RandomStream } from './random.ts';

export type Activation = 'tanh' | 'relu' | 'sigmoid';
export interface Sample { id: string; inputs: number[]; target: 0 | 1 }
export interface Network {
  engineVersion: 'dense-binary-sgd-v1';
  sizes: number[];
  hiddenActivation: Activation;
  /** weights[layer][destination neuron][source neuron] */
  weights: number[][][];
  biases: number[][];
}
export interface Trace {
  /** Includes the input layer at index 0. */
  activations: number[][];
  preactivations: number[][];
  probability: number;
  logit: number;
}
export interface Gradients { weights: number[][][]; biases: number[][] }
export interface Metrics {
  loss: number;
  accuracy: number;
  count: number;
  /** Actual rows, predicted columns. Threshold: probability >= 0.5. */
  confusion: [[number, number], [number, number]];
}

function finite(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} debe ser un número finito.`);
  }
  return value;
}

function validateSizes(sizes: readonly number[]) {
  if (!Array.isArray(sizes) || sizes.length < 2 || sizes.length > 5) {
    throw new Error('La red admite de cero a tres capas ocultas.');
  }
  if (sizes.some(size => !Number.isInteger(size) || size < 1 || size > 12) || sizes.at(-1) !== 1) {
    throw new Error('Cada capa admite de 1 a 12 unidades; la salida binaria debe tener una unidad.');
  }
}

export function validateNetwork(network: Network): void {
  if (!network || network.engineVersion !== 'dense-binary-sgd-v1') throw new Error('Versión de motor no compatible.');
  validateSizes(network.sizes);
  if (!['tanh', 'relu', 'sigmoid'].includes(network.hiddenActivation)) throw new Error('Activación no compatible.');
  const layers = network.sizes.length - 1;
  if (!Array.isArray(network.weights) || !Array.isArray(network.biases)
      || network.weights.length !== layers || network.biases.length !== layers) {
    throw new Error('Las matrices no corresponden a las capas de la red.');
  }
  for (let layer = 0; layer < layers; layer++) {
    const width = network.sizes[layer + 1];
    if (!Array.isArray(network.weights[layer]) || !Array.isArray(network.biases[layer])
        || network.weights[layer].length !== width || network.biases[layer].length !== width) {
      throw new Error(`Dimensiones inválidas en la capa ${layer + 1}.`);
    }
    for (let neuron = 0; neuron < width; neuron++) {
      const row = network.weights[layer][neuron];
      if (!Array.isArray(row) || row.length !== network.sizes[layer]) throw new Error('Conexiones incompatibles.');
      row.forEach(weight => finite(weight, 'El peso'));
      finite(network.biases[layer][neuron], 'El sesgo');
    }
  }
}

export function createNetwork(sizes: number[], seed = 11, hiddenActivation: Activation = 'tanh'): Network {
  validateSizes(sizes);
  const random = createRandom(seed);
  const network: Network = {
    engineVersion: 'dense-binary-sgd-v1', sizes: [...sizes], hiddenActivation, weights: [], biases: [],
  };
  for (let layer = 1; layer < sizes.length; layer++) {
    const bound = hiddenActivation === 'relu' && layer < sizes.length - 1
      ? Math.sqrt(6 / sizes[layer - 1]) : Math.sqrt(6 / (sizes[layer - 1] + sizes[layer]));
    network.weights.push(Array.from({ length: sizes[layer] }, () =>
      Array.from({ length: sizes[layer - 1] }, () => (random.next() * 2 - 1) * bound)));
    network.biases.push(Array(sizes[layer]).fill(0));
  }
  validateNetwork(network);
  return network;
}

export function cloneNetwork(network: Network): Network {
  return { ...network, sizes: [...network.sizes], weights: network.weights.map(layer => layer.map(row => [...row])), biases: network.biases.map(row => [...row]) };
}

export function sigmoid(value: number): number {
  finite(value, 'La preactivación');
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function activate(value: number, activation: Activation) {
  return activation === 'tanh' ? Math.tanh(value) : activation === 'relu' ? Math.max(0, value) : sigmoid(value);
}

function derivative(value: number, output: number, activation: Activation) {
  return activation === 'tanh' ? 1 - output * output : activation === 'relu' ? (value > 0 ? 1 : 0) : output * (1 - output);
}

function forwardUnchecked(network: Network, inputs: readonly number[]): Trace {
  if (!Array.isArray(inputs) || inputs.length !== network.sizes[0]) throw new Error('El número de entradas no coincide con la red.');
  inputs.forEach(value => finite(value, 'La entrada'));
  const activations = [[...inputs]];
  const preactivations: number[][] = [];
  for (let layer = 0; layer < network.weights.length; layer++) {
    const last = layer === network.weights.length - 1;
    const z = network.weights[layer].map((weights, neuron) => finite(weights.reduce(
      (sum, weight, index) => sum + weight * activations[layer][index], network.biases[layer][neuron]), 'La preactivación'));
    preactivations.push(z);
    activations.push(z.map(value => last ? sigmoid(value) : activate(value, network.hiddenActivation)));
  }
  return { activations, preactivations, probability: activations.at(-1)![0], logit: preactivations.at(-1)![0] };
}

export function forward(network: Network, inputs: readonly number[]): Trace {
  validateNetwork(network);
  return forwardUnchecked(network, inputs);
}

function validateTarget(target: number): void {
  if (target !== 0 && target !== 1) throw new Error('El objetivo binario debe ser 0 o 1.');
}

/** BCE computed from logits, without unstable log(0) or clipping artifacts. */
export function binaryLoss(logit: number, target: number): number {
  finite(logit, 'El logit');
  validateTarget(target);
  return Math.max(logit, 0) - target * logit + Math.log1p(Math.exp(-Math.abs(logit)));
}

function gradientsUnchecked(network: Network, sample: Sample): Gradients {
  validateTarget(sample.target);
  const trace = forwardUnchecked(network, sample.inputs);
  const gradients: Gradients = { weights: network.weights.map(layer => layer.map(row => row.map(() => 0))), biases: network.biases.map(row => row.map(() => 0)) };
  let delta = [trace.probability - sample.target];
  for (let layer = network.weights.length - 1; layer >= 0; layer--) {
    gradients.biases[layer] = [...delta];
    gradients.weights[layer] = delta.map(value => trace.activations[layer].map(input => value * input));
    if (layer > 0) {
      delta = trace.activations[layer].map((output, neuron) => {
        const propagated = delta.reduce((sum, value, next) => sum + network.weights[layer][next][neuron] * value, 0);
        return propagated * derivative(trace.preactivations[layer - 1][neuron], output, network.hiddenActivation);
      });
    }
  }
  return gradients;
}

export function gradients(network: Network, sample: Sample): Gradients {
  validateNetwork(network);
  return gradientsUnchecked(network, sample);
}

export function evaluate(network: Network, samples: readonly Sample[]): Metrics {
  validateNetwork(network);
  if (samples.length === 0) throw new Error('Se necesita al menos una muestra para evaluar.');
  let loss = 0;
  let correct = 0;
  const confusion: Metrics['confusion'] = [[0, 0], [0, 0]];
  for (const sample of samples) {
    validateTarget(sample.target);
    const trace = forwardUnchecked(network, sample.inputs);
    const predicted = trace.probability >= 0.5 ? 1 : 0;
    loss += binaryLoss(trace.logit, sample.target);
    correct += Number(predicted === sample.target);
    confusion[sample.target][predicted]++;
  }
  return { loss: finite(loss / samples.length, 'La pérdida media'), accuracy: correct / samples.length, count: samples.length, confusion };
}

/** One epoch of mini-batch SGD. Input network and samples remain unchanged. */
export function trainEpoch(network: Network, samples: readonly Sample[], options: {
  learningRate: number; batchSize: number; random: RandomStream;
}): Network {
  validateNetwork(network);
  if (!samples.length) throw new Error('No hay muestras de entrenamiento.');
  if (!Number.isFinite(options.learningRate) || options.learningRate <= 0 || options.learningRate > 1) {
    throw new Error('La tasa de aprendizaje debe ser mayor que 0 y menor o igual a 1.');
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 128) {
    throw new Error('El tamaño de lote debe ser un entero entre 1 y 128.');
  }
  const result = cloneNetwork(network);
  const ordered = shuffle(samples, options.random);
  for (let offset = 0; offset < ordered.length; offset += options.batchSize) {
    const batch = ordered.slice(offset, offset + options.batchSize);
    const accumulated: Gradients = { weights: result.weights.map(layer => layer.map(row => row.map(() => 0))), biases: result.biases.map(row => row.map(() => 0)) };
    for (const sample of batch) {
      const gradient = gradientsUnchecked(result, sample);
      for (let layer = 0; layer < result.weights.length; layer++) {
        for (let neuron = 0; neuron < result.weights[layer].length; neuron++) {
          accumulated.biases[layer][neuron] += gradient.biases[layer][neuron];
          for (let input = 0; input < result.weights[layer][neuron].length; input++) {
            accumulated.weights[layer][neuron][input] += gradient.weights[layer][neuron][input];
          }
        }
      }
    }
    const rate = options.learningRate / batch.length;
    result.weights.forEach((layer, l) => layer.forEach((row, n) => {
      result.biases[l][n] = finite(result.biases[l][n] - rate * accumulated.biases[l][n], 'El nuevo sesgo');
      row.forEach((weight, i) => { row[i] = finite(weight - rate * accumulated.weights[l][n][i], 'El nuevo peso'); });
    }));
  }
  return result;
}

export function parameterCount(network: Network): number {
  validateNetwork(network);
  return network.sizes.slice(1).reduce((sum, width, index) => sum + (network.sizes[index] + 1) * width, 0);
}

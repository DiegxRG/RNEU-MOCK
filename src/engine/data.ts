import { createRandom, shuffle } from './random.ts';
import type { Sample } from './network.ts';

export function generateXor(count = 240, seed = 41): Sample[] {
  if (!Number.isInteger(count) || count < 40 || count > 2000 || count % 4 !== 0) {
    throw new Error('XOR requiere un múltiplo de 4 entre 40 y 2000 muestras.');
  }
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const quadrant = index % 4;
    const x = (0.05 + random.next() * 0.95) * (quadrant < 2 ? 1 : -1);
    const y = (0.05 + random.next() * 0.95) * (quadrant % 2 === 0 ? 1 : -1);
    return { id: `xor-${seed}-${index}`, inputs: [x, y], target: x * y < 0 ? 1 : 0 };
  });
}

export interface Partitions { train: Sample[]; validation: Sample[]; test: Sample[] }

export function stratifiedSplit(samples: readonly Sample[], seed = 71, ratios = [0.7, 0.15, 0.15]): Partitions {
  if (ratios.length !== 3 || ratios.some(value => !Number.isFinite(value) || value <= 0)
      || Math.abs(ratios.reduce((sum, value) => sum + value, 0) - 1) > 1e-10) {
    throw new Error('Las tres proporciones deben ser positivas y sumar 1.');
  }
  if (new Set(samples.map(row => row.id)).size !== samples.length) throw new Error('Los identificadores de muestra deben ser únicos.');
  if (samples.some(row => row.target !== 0 && row.target !== 1)) throw new Error('Solo se admiten objetivos binarios.');
  const random = createRandom(seed);
  const result: Partitions = { train: [], validation: [], test: [] };
  for (const target of [0, 1]) {
    const group = shuffle(samples.filter(row => row.target === target), random);
    const trainingCount = Math.floor(group.length * ratios[0]);
    const validationCount = Math.floor(group.length * ratios[1]);
    if (Math.min(trainingCount, validationCount, group.length - trainingCount - validationCount) < 1) {
      throw new Error('Cada clase necesita muestras en entrenamiento, validación y prueba.');
    }
    result.train.push(...group.slice(0, trainingCount));
    result.validation.push(...group.slice(trainingCount, trainingCount + validationCount));
    result.test.push(...group.slice(trainingCount + validationCount));
  }
  return { train: shuffle(result.train, random), validation: shuffle(result.validation, random), test: shuffle(result.test, random) };
}

export interface Standardizer { means: number[]; scales: number[] }

function validateInputs(samples: readonly Sample[], width?: number): number {
  const dimensions = width ?? samples[0]?.inputs.length;
  if (!dimensions || samples.some(row => row.inputs.length !== dimensions || row.inputs.some(value => !Number.isFinite(value)))) {
    throw new Error('Las entradas deben tener dimensiones consistentes y números finitos.');
  }
  return dimensions;
}

/** Call with the training partition only. Never fits on validation or test. */
export function fitStandardizer(training: readonly Sample[]): Standardizer {
  if (!training.length) throw new Error('No hay datos para ajustar el escalado.');
  const width = validateInputs(training);
  const means = Array.from({ length: width }, (_, index) => training.reduce((sum, row) => sum + row.inputs[index], 0) / training.length);
  const scales = means.map((mean, index) => {
    const variance = training.reduce((sum, row) => sum + (row.inputs[index] - mean) ** 2, 0) / training.length;
    return Math.sqrt(variance) || 1;
  });
  if ([...means, ...scales].some(value => !Number.isFinite(value))) throw new Error('Los valores exceden el rango numérico del escalado.');
  return { means, scales };
}

export function transform(samples: readonly Sample[], standardizer: Standardizer): Sample[] {
  const { means, scales } = standardizer;
  if (!Array.isArray(means) || !Array.isArray(scales) || !means.length || scales.length !== means.length
      || means.some(value => !Number.isFinite(value)) || scales.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('El escalado guardado no es válido.');
  }
  validateInputs(samples, means.length);
  return samples.map(row => {
    const inputs = row.inputs.map((value, index) => (value - means[index]) / scales[index]);
    if (inputs.some(value => !Number.isFinite(value))) throw new Error('El escalado produjo un valor fuera de rango.');
    return { ...row, inputs };
  });
}

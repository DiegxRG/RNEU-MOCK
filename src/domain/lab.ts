import { createNetwork, type Activation, type Network, type Metrics, type Sample } from '../engine/network.ts';
import { generateXor, type Partitions, type Standardizer } from '../engine/data.ts';

export type Role = 'owner' | 'engineer' | 'reviewer' | 'reader' | 'admin';
export const roleLabels: Record<Role, string> = { owner: 'Responsable', engineer: 'Ingeniero de IA', reviewer: 'Revisor', reader: 'Lector', admin: 'Administrador' };
export type RunStatus = 'queued' | 'preparing' | 'running' | 'pausing' | 'paused' | 'completed' | 'cancelled' | 'failed';
export const statusLabels: Record<RunStatus, string> = { queued: 'En cola', preparing: 'Preparando', running: 'Entrenando', pausing: 'Pausando', paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado', failed: 'Fallido' };
export interface Config { hidden: number[]; activation: Activation; learningRate: number; batchSize: number; epochs: number; seed: number }
export interface Dataset { id: string; name: string; kind: 'xor' | 'circle' | 'linear' | 'csv'; features: string[]; labels: [string, string]; rows: Sample[] }
export interface Project { id: string; name: string; description: string; createdAt: string; dataset: Dataset; config: Config }
export interface EpochRecord { epoch: number; trainLoss: number; validationLoss: number; trainAccuracy: number; validationAccuracy: number }
export interface Run {
  id: string; projectId: string; name: string; createdAt: string; status: RunStatus; epoch: number;
  config: Config; dataset: Dataset; split: Partitions; normalizer: Standardizer;
  network: Network; randomState: number; history: EpochRecord[]; testMetrics?: Metrics; error?: string;
}
export interface Model { id: string; projectId: string; runId: string; name: string; version: number; status: 'draft' | 'review' | 'approved' | 'retired'; createdAt: string; checksum: string; snapshot: Run }
export interface Audit { id: string; date: string; projectId: string; actor: Role; action: string }
export interface LabState { schemaVersion: 1; activeProjectId: string; role: Role; projects: Project[]; runs: Run[]; models: Model[]; audit: Audit[] }

export const defaultConfig: Config = { hidden: [4, 4], activation: 'tanh', learningRate: 0.1, batchSize: 16, epochs: 450, seed: 11 };
export const uid = () => crypto.randomUUID();
export const activeStatus = (status: RunStatus) => ['queued', 'preparing', 'running', 'pausing'].includes(status);
export const canEdit = (role: Role) => ['owner', 'engineer', 'admin'].includes(role);
export const canReview = (role: Role) => ['reviewer', 'admin'].includes(role);

export function makeDataset(kind: Dataset['kind'] = 'xor', count = 240): Dataset {
  if (kind === 'csv') throw new Error('Selecciona un archivo CSV.');
  const rows = generateXor(count, 41);
  if (kind !== 'xor') rows.forEach(row => {
    row.target = kind === 'circle' ? Number(row.inputs[0] ** 2 + row.inputs[1] ** 2 < 0.55) as 0 | 1
      : Number(row.inputs[0] + row.inputs[1] > 0) as 0 | 1;
  });
  return { id: uid(), name: { xor: 'XOR · cuatro cuadrantes', circle: 'Círculo · dentro y fuera', linear: 'Separación lineal' }[kind], kind, features: ['x₁', 'x₂'], labels: ['Clase 0', 'Clase 1'], rows };
}

export function initialState(): LabState {
  const project: Project = { id: uid(), name: 'Aprender con XOR', description: 'Descubrir cómo una red aprende a separar dos clases que no se pueden dividir con una sola línea.', createdAt: new Date().toISOString(), dataset: makeDataset(), config: structuredClone(defaultConfig) };
  return { schemaVersion: 1, activeProjectId: project.id, role: 'owner', projects: [project], runs: [], models: [], audit: [] };
}

export function validateConfig(config: Config, inputs: number): void {
  if (!Number.isInteger(config.epochs) || config.epochs < 1 || config.epochs > 2000) throw new Error('Usa entre 1 y 2000 épocas.');
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 128) throw new Error('Usa un lote entre 1 y 128.');
  if (!Number.isFinite(config.learningRate) || config.learningRate <= 0 || config.learningRate > 1) throw new Error('Usa una tasa de aprendizaje mayor que 0 y hasta 1.');
  createNetwork([inputs, ...config.hidden, 1], config.seed, config.activation);
}

/** Small RFC4180-style CSV reader; parsing never executes input. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field.length === 0) quoted = !quoted;
      else throw new Error('Comillas inesperadas en el CSV.');
    } else if (!quoted && (char === ',' || char === ';')) { row.push(field.trim()); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(cell => cell !== '')) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(field.trim()); if (row.some(cell => cell !== '')) rows.push(row);
  if (rows.length < 3) throw new Error('El CSV debe incluir cabecera y al menos dos filas.');
  const width = rows[0].length;
  if (width < 2 || width > 13 || rows.some(values => values.length !== width)) throw new Error('Usa de 2 a 13 columnas con el mismo número de valores en cada fila.');
  if (new Set(rows[0]).size !== width || rows[0].some(name => !name)) throw new Error('Las columnas deben tener nombres únicos y no vacíos.');
  if (rows.length - 1 > 2000) throw new Error('El límite local es de 2000 muestras.');
  return rows;
}

export function datasetFromCsv(table: string[][], targetIndex: number, name: string): Dataset {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= table[0].length) throw new Error('Confirma la columna objetivo.');
  const labels = [...new Set(table.slice(1).map(row => row[targetIndex]))].sort();
  if (labels.length !== 2 || labels.some(label => !label)) throw new Error('El objetivo debe contener exactamente dos clases no vacías.');
  const id = uid();
  const rows = table.slice(1).map((row, index): Sample => {
    const inputs = row.filter((_, i) => i !== targetIndex).map(value => {
      if (!value || !Number.isFinite(Number(value))) throw new Error(`Fila ${index + 2}: las entradas deben ser números y no pueden estar vacías.`);
      return Number(value);
    });
    return { id: `${id}-${index}`, inputs, target: row[targetIndex] === labels[1] ? 1 : 0 };
  });
  return { id, name: name.slice(0, 100), kind: 'csv', features: table[0].filter((_, i) => i !== targetIndex), labels: [labels[0], labels[1]], rows };
}

export function download(content: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeCsv(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const text = typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}

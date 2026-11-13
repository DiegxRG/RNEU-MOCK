import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initialState, uid, canEdit, canReview, activeStatus, validateConfig, type LabState, type Project, type Config, type Dataset, type Run, type Role, type Model, type EpochRecord } from '../domain/lab.ts';
import { createNetwork, evaluate, type Network } from '../engine/network.ts';
import { fitStandardizer, stratifiedSplit, transform } from '../engine/data.ts';
import { loadState, saveState } from '../lib/storage.ts';

function useController() {
  const [state, setState] = useState<LabState>(() => initialState());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [playbackSpeed, setSpeed] = useState(0.5);
  const worker = useRef<Worker | null>(null);
  const stateRef = useRef(state); stateRef.current = state;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnlySession = useRef(false);
  const commit = (action: string, update: (previous: LabState) => LabState) => setState(previous => {
    const next = update(previous);
    return { ...next, audit: [{ id: uid(), date: new Date().toISOString(), projectId: next.activeProjectId, actor: previous.role, action }, ...next.audit].slice(0, 300) };
  });
  useEffect(() => {
    let disposed = false;
    loadState().then(saved => {
      if (disposed) return;
      if (saved) setState({ ...saved, runs: saved.runs.map(run => activeStatus(run.status) ? { ...run, status: 'paused', error: 'Sesión recuperada desde la última época guardada. Puedes continuar.' } : run) });
      setReady(true);
    }).catch(error => { if (!disposed) { readOnlySession.current = true; setStorageError(`Sesión temporal: ${String(error)}. Puedes exportar tus resultados.`); setReady(true); } });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!ready || readOnlySession.current || saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveState(stateRef.current).catch(() => setStorageError('No se pudo guardar en este navegador. Exporta los resultados antes de cerrar.'));
    }, 400);
  }, [state, ready]);
  useEffect(() => () => { worker.current?.terminate(); if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const project = state.projects.find(item => item.id === state.activeProjectId) ?? state.projects[0];
  const runs = state.runs.filter(run => run.projectId === project.id);
  const currentRun = runs[0];
  const busy = state.runs.some(run => activeStatus(run.status) || run.status === 'paused');
  const editingAllowed = () => { if (!canEdit(stateRef.current.role)) throw new Error('Este rol permite consultar, pero no modificar experimentos.'); };
  const guard = (operation: () => void | Promise<void>) => { try { Promise.resolve(operation()).catch(error => setNotice(error instanceof Error ? error.message : String(error))); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } };

  function launch(run: Run, single = false) {
    worker.current?.terminate();
    const instance = new Worker(new URL('../workers/training.worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = event => {
      const message = event.data as { type: string; id: string; network: Network; epoch: number; randomState: number; metrics: EpochRecord[]; status: Run['status']; error: string };
      setState(previous => {
        const target = previous.runs.find(item => item.id === message.id);
        if (!target || ['completed', 'failed', 'cancelled'].includes(target.status)) return previous;
        const next = message.type === 'error' ? { ...target, status: 'failed' as const, error: message.error }
          : { ...target, network:message.network, epoch:message.epoch, randomState:message.randomState, status: target.status === 'pausing' && message.status === 'running' ? 'pausing' as const : message.status, history: [...target.history, ...message.metrics], error: undefined };
        if (next.status === 'completed') next.testMetrics = evaluate(next.network, transform(next.split.test, next.normalizer));
        const terminal = next.status !== target.status && ['completed', 'cancelled', 'failed', 'paused'].includes(next.status);
        return { ...previous, runs: previous.runs.map(item => item.id === next.id ? next : item), audit: terminal ? [{ id: uid(), date: new Date().toISOString(), projectId: next.projectId, actor: previous.role, action: `Entrenamiento ${next.name}: ${next.status}` }, ...previous.audit].slice(0, 300) : previous.audit };
      });
    };
    instance.onerror = () => setState(previous => ({ ...previous, runs: previous.runs.map(item => item.id === run.id ? { ...item, status: 'failed', error: 'El proceso de cálculo se detuvo. Inicia una nueva ejecución.' } : item) }));
    instance.postMessage({ type: 'start', run, single, speed:playbackSpeed });
  }

  function setPlaybackSpeed(speed: number) {
    if (![0.25,0.5,1,2,4].includes(speed)) return;
    setSpeed(speed); worker.current?.postMessage({type:'speed',speed});
  }

  function start(single = false) { guard(() => {
    editingAllowed();
    if (stateRef.current.runs.some(run => activeStatus(run.status))) throw new Error('Ya hay un entrenamiento activo.');
    if (currentRun?.status === 'paused') {
      const resumed = { ...currentRun, status: 'running' as const, error: undefined };
      commit('Continuar entrenamiento', previous => ({ ...previous, runs: previous.runs.map(item => item.id === resumed.id ? resumed : item) }));
      launch(resumed, single); return;
    }
    if (stateRef.current.runs.some(run => run.status === 'paused')) throw new Error('Continúa o cancela el entrenamiento pausado del otro proyecto.');
    validateConfig(project.config, project.dataset.features.length);
    const split = stratifiedSplit(project.dataset.rows, 71);
    const normalizer = fitStandardizer(split.train);
    const network = createNetwork([project.dataset.features.length, ...project.config.hidden, 1], project.config.seed, project.config.activation);
    const t = evaluate(network, transform(split.train, normalizer)), v = evaluate(network, transform(split.validation, normalizer));
    const sequence = Math.max(0,...runs.map(item=>Number(item.name.match(/\d+$/)?.[0])||0))+1;
    const run: Run = { id: uid(), name: `Experimento ${sequence}`, projectId: project.id, createdAt: new Date().toISOString(), status: 'running', config: structuredClone(project.config), dataset: structuredClone(project.dataset), split, normalizer, network, randomState: 151, epoch: 0, history: [{ epoch: 0, trainLoss: t.loss, validationLoss: v.loss, trainAccuracy: t.accuracy, validationAccuracy: v.accuracy }] };
    commit('Iniciar entrenamiento', previous => ({ ...previous, runs: [run, ...previous.runs].slice(0, 30) }));
    launch(run, single);
  }); }

  function pause() { guard(() => {
    editingAllowed(); if (!currentRun || currentRun.status !== 'running') return;
    commit('Solicitar pausa', previous => ({ ...previous, runs: previous.runs.map(item => item.id === currentRun.id ? { ...item, status: 'pausing' } : item) }));
    worker.current?.postMessage({ type: 'pause' });
  }); }
  function cancel() { guard(() => {
    editingAllowed(); if (!currentRun || ![...['paused', 'pausing', 'running']].includes(currentRun.status)) return;
    if (currentRun.status === 'paused') {
      worker.current?.terminate();
      commit('Cancelar entrenamiento pausado', previous => ({ ...previous, runs: previous.runs.map(item => item.id === currentRun.id ? { ...item, status: 'cancelled' } : item) }));
    } else worker.current?.postMessage({ type: 'cancel' });
  }); }

  function updateProject(patch: Partial<Pick<Project, 'name' | 'description' | 'dataset' | 'config'>>) { guard(() => {
    editingAllowed(); if (busy) throw new Error('Finaliza o cancela la ejecución antes de cambiar el proyecto.');
    commit('Actualizar proyecto', previous => ({ ...previous, projects: previous.projects.map(item => item.id === project.id ? { ...item, ...patch } : item) }));
  }); }
  function updateConfig(patch: Partial<Config>) { updateProject({ config: { ...project.config, ...patch } }); }
  function setDataset(dataset: Dataset) { guard(()=>{stratifiedSplit(dataset.rows);updateProject({ dataset });}); }
  function createProject(name: string, description: string) { guard(() => {
    editingAllowed(); if (!name.trim()) throw new Error('Escribe el nombre del proyecto.');
    if (state.projects.length >= 15) throw new Error('El límite de la demostración es de 15 proyectos.');
    const item: Project = { ...initialState().projects[0], id: uid(), name: name.trim().slice(0, 80), description: description.slice(0, 500) };
    commit('Crear proyecto', previous => ({ ...previous, projects: [...previous.projects, item], activeProjectId: item.id }));
  }); }
  function selectProject(id: string) { if (state.projects.some(item => item.id === id)) setState(previous => ({ ...previous, activeProjectId: id })); }
  function setRole(role: Role) { commit(`Cambiar rol de demostración: ${role}`, previous => ({ ...previous, role })); }
  function registerModel(runId: string) { guard(async () => {
    editingAllowed(); const run = state.runs.find(item => item.id === runId);
    if (!run || run.status !== 'completed') throw new Error('Solo se pueden registrar entrenamientos completados.');
    if (stateRef.current.models.some(model=>model.runId===runId)) throw new Error('Esta ejecución ya tiene una versión registrada.');
    const snapshot = structuredClone(run);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
    const checksum = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
    commit('Registrar versión de modelo', previous => {
      if (previous.models.some(model => model.runId === runId)) return previous;
      const version = Math.max(0, ...previous.models.filter(item => item.projectId === run.projectId).map(item => item.version)) + 1;
      const model: Model = { id: uid(), projectId: run.projectId, runId, name: `${run.dataset.name} · MLP`, version, status: 'draft', createdAt: new Date().toISOString(), checksum, snapshot };
      return { ...previous, models: [model, ...previous.models] };
    }); setNotice('Modelo registrado. La arquitectura, los pesos y el escalado quedaron guardados.');
  }); }
  function modelStatus(id: string, next: Model['status']) { guard(() => {
    const item = state.models.find(model => model.id === id); if (!item) return;
    const allowed = item.status === 'draft' && next === 'review' ? canEdit(state.role)
      : item.status === 'review' && next === 'approved' ? canReview(state.role)
      : item.status === 'approved' && next === 'retired' ? canReview(state.role) : false;
    if (!allowed) throw new Error('El rol o el estado actual no permiten esta transición.');
    commit(`Modelo v${item.version}: ${next}`, previous => ({ ...previous, models: previous.models.map(model => model.id === id ? { ...model, status: next } : model) }));
  }); }
  return { state, project, runs, currentRun, busy, ready, storageError, notice, setNotice, updateConfig, updateProject, setDataset, createProject, selectProject, setRole, start, pause, cancel, registerModel, modelStatus, playbackSpeed, setPlaybackSpeed };
}

const Context = createContext<ReturnType<typeof useController> | null>(null);
export function LabProvider({ children }: { children: ReactNode }) { const value = useController(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useLab() { const value = useContext(Context); if (!value) throw new Error('Falta el proveedor de NeuroLab.'); return value; }

import type { LabState } from '../domain/lab.ts';
import { validateNetwork } from '../engine/network.ts';

const databaseName = 'neurolab-local-v1';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Otra pestaña está bloqueando el almacenamiento.'));
  });
}

export async function loadState(): Promise<LabState | null> {
  const db = await openDb();
  try {
    const data = await new Promise<LabState | undefined>((resolve, reject) => {
      const request = db.transaction('workspace').objectStore('workspace').get('state');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (!data) return null;
    if (data.schemaVersion !== 1 || !Array.isArray(data.projects) || !data.projects.length
      || !Array.isArray(data.runs) || !Array.isArray(data.models) || !Array.isArray(data.audit)) throw new Error('El espacio guardado tiene un formato incompatible.');
    data.runs.forEach(run => validateNetwork(run.network));
    data.models.forEach(model => validateNetwork(model.snapshot.network));
    return data;
  } finally { db.close(); }
}

export async function saveState(state: LabState): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('workspace', 'readwrite');
      transaction.objectStore('workspace').put(state, 'state');
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

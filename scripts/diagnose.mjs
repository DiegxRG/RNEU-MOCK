import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '5173' } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto inválido.');
  let reachable = false;
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const url = `http://${host}:${port}/`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      await response.body?.cancel();
      console.log(`${url} -> HTTP ${response.status}`);
      if (response.ok) reachable = true;
    } catch (error) {
      const code = error.cause?.code ?? error.code ?? error.name;
      const detail = code === 'ECONNREFUSED' ? 'No hay un servidor aceptando conexiones en esta dirección.'
        : code === 'EACCES' || code === 'EPERM' ? 'Este proceso no tiene permiso para abrir la conexión; prueba desde tu terminal normal.'
        : 'No se pudo conectar dentro del tiempo permitido.';
      console.log(`${url} -> ${code}: ${detail}`);
    }
  }
  if (!reachable) {
    console.log('\nMantén npm run dev abierto en otra terminal y usa el puerto que muestre su salida.');
    process.exitCode = 1;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

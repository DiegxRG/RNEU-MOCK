import { parseArgs } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server;
let closing = false;

async function close() {
  if (closing) return;
  closing = true;
  await server?.close();
}

async function main() {
  const { values } = parseArgs({ options: {
    port: { type: 'string', default: '5173' },
    open: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.log('npm run dev [-- --port 5174] [-- --open]\nInicia Vite en 127.0.0.1 y comprueba la respuesta HTTP antes de mostrar el enlace.');
    return;
  }
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('El puerto debe ser un entero entre 1024 y 65535.');
  server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    clearScreen: false,
    server: { host: '127.0.0.1', port, strictPort: false, open: false },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { close().finally(() => process.exit(0)); });
  }
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite no expuso un puerto HTTP.');
  const url = `http://127.0.0.1:${address.port}/`;
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await response.text();
    if (!response.ok || !html.includes('/src/main.tsx')) throw new Error(`La página inicial no es la esperada (HTTP ${response.status}).`);
  } catch (error) {
    const code = error.cause?.code ?? error.code ?? error.name;
    throw new Error(`El puerto ${address.port} está abierto, pero no se pudo comprobar su respuesta HTTP (${code}). Ejecuta npm run dev desde tu propia terminal de Windows.`, { cause: error });
  }
  console.log(`\nNeuroLab · servidor HTTP verificado (${response.status})`);
  console.log(`\n  Abre esta dirección: ${url}`);
  if (address.port !== port) console.log(`  El puerto ${port} estaba ocupado; se está usando ${address.port}.`);
  console.log('\n  Mantén esta terminal abierta. Para detener el servidor: Ctrl+C.\n');
  if (values.open) server.openBrowser();
  server.bindCLIShortcuts({ print: false });
}

main().catch(async error => {
  console.error(`\nNo se pudo iniciar NeuroLab: ${error.message}`);
  if (error.cause) console.error(`Detalle: ${error.cause.message}`);
  await close();
  process.exitCode = 1;
});

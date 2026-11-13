import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Validate the built app without depending on a running dev server or external network.
const root=path.resolve('dist'),origin='http://127.0.0.1:4179',out=path.resolve('tmp/ui');
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('Ejecuta npm run build antes de comprobar la interfaz.');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.NEUROLAB_BROWSER_EXECUTABLE?{executablePath:process.env.NEUROLAB_BROWSER_EXECUTABLE}:{}),args:['--enable-unsafe-swiftshader']});
const errors=[],checks=[];
async function makePage(options={}) {
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,...options});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){await route.abort();return;}
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
    await route.fulfill({status:200,body:fs.readFileSync(file),contentType:mime[path.extname(file)]??'application/octet-stream'});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));return page;
}
async function noOverflow(page,label) {
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: unexpected horizontal overflow`);
}
async function navigate(page,route,heading) {
  await page.evaluate(route=>{location.hash='/'+route},route);await page.getByRole('heading',{name:heading,exact:true}).waitFor();
}
async function enter(page) {
  await page.getByRole('button',{name:'Completar cuenta demo'}).click();
  await page.getByRole('button',{name:'Entrar al laboratorio',exact:true}).click();
}
try {
  const page=await makePage();
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.landing-home-panel')?.style.opacity==='1');
  await page.getByRole('group',{name:'Red neuronal artificial tridimensional con capas, conexiones y señales de aprendizaje',exact:true}).waitFor();
  await page.locator('canvas.neural-canvas').waitFor();
  await page.screenshot({path:path.join(out,'landing.png'),fullPage:true});await noOverflow(page,'desktop landing');
  assert.equal(await page.locator('.neuro-landing').evaluate(el=>el.getBoundingClientRect().top),0,'public background must cover the viewport without a collapsed top margin');
  assert.equal(await page.locator('.neural-controls-dock').evaluate(el=>getComputedStyle(el).opacity),'0');
  await page.getByRole('button',{name:'Pausar animaciones',exact:true}).focus();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.neural-controls-dock')).opacity==='1');
  await page.getByRole('button',{name:'Pausar animaciones',exact:true}).click();
  const still=await page.locator('.neural-canvas').screenshot();await page.waitForTimeout(180);
  assert.ok(still.equals(await page.locator('.neural-canvas').screenshot()),'network must stop moving when paused');
  await page.getByRole('button',{name:'Girar red a la derecha'}).click();
  assert.ok(!still.equals(await page.locator('.neural-canvas').screenshot()),'keyboard-accessible rotation must change view');
  checks.push('layered WebGL network, hidden controls revealed by focus, pause and rotation');
  const scene=await page.locator('.neural-canvas').elementHandle();
  await page.getByRole('link',{name:'Entrar',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.login-panel')?.style.opacity==='1');
  assert.ok(await scene.evaluate(el=>el.isConnected),'scene persists through the login transition');
  await page.locator('#demo-email').fill('wrong@example.test');await page.locator('#demo-password').fill('wrong');
  await page.getByRole('button',{name:'Entrar al laboratorio',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.screenshot({path:path.join(out,'login.png'),fullPage:true});await enter(page);
  await page.getByRole('heading',{name:'Resumen general',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>!sessionStorage.getItem('neurolab-demo-session-v1').includes('neuro-demo')));
  checks.push('demo credential feedback and session without stored password');

  await navigate(page,'fundamentals','Aprende experimentando');
  await page.getByRole('button',{name:'Aprender de esta muestra',exact:true}).click();
  await page.getByText('1 ajustes',{exact:true}).waitFor();
  await page.getByRole('button',{name:/El gradiente del error/}).click();
  await page.getByRole('button',{name:'Comprobar idea',exact:true}).click();await page.getByText('1 / 4 ideas descubiertas',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'fundamentals.png'),fullPage:true});
  await page.getByRole('tab',{name:/Visión por filtros/}).click();
  const pixel=page.getByRole('button',{name:'Píxel fila 1, columna 1: 0',exact:true});await pixel.click();
  assert.equal(await page.getByRole('button',{name:'Píxel fila 1, columna 1: 1',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Una ventana',exact:true}).click();await page.getByText('2 / 9 ventanas',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'convolution.png'),fullPage:true});
  await page.getByRole('tab',{name:/Una red con memoria/}).click();await page.getByRole('button',{name:'Un paso',exact:true}).click();await page.getByText('Paso 1 / 4',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Sin memoria',exact:true}).click();assert.equal(await page.locator('#rnn-memory').inputValue(),'0');
  await page.getByRole('tab',{name:/Crear y distinguir/}).click();await page.getByRole('button',{name:'Jugar una ronda',exact:true}).click();await page.getByText('Ronda 1 / 200',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'adversarial.png'),fullPage:true});
  checks.push('four interactive lessons and quiz progress');

  await navigate(page,'laboratory','Laboratorio neuronal');await page.locator('#epochs').fill('18');
  assert.equal(await page.getByRole('combobox',{name:'Velocidad de demostración'}).inputValue(),'0.5');
  await page.getByRole('button',{name:'Entrenar red',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'))>=2);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-flow-particle]')).some(el=>Number(getComputedStyle(el).opacity)>0));
  await page.screenshot({path:path.join(out,'laboratory.png'),fullPage:true});
  await page.getByRole('button',{name:'Pausar',exact:true}).click();await page.getByText('Pausado',{exact:true}).first().waitFor();
  const epoch=await page.getByRole('progressbar').getAttribute('aria-valuenow');await page.waitForTimeout(250);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),epoch);
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Completado',{exact:true}).first().waitFor();
  await page.evaluate(()=>window.scrollTo(0,700));
  const panels=await page.locator('.lab-config,.lab-inspector').evaluateAll(elements=>elements.map(el=>({position:getComputedStyle(el).position,top:el.getBoundingClientRect().top})));
  assert.ok(panels.every(panel=>panel.position==='sticky'&&Math.abs(panel.top-16)<2));
  await page.screenshot({path:path.join(out,'sticky.png')});checks.push('guided training, visible particle aura, pause/resume and sticky panels');

  await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Laboratorio neuronal',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión de demostración',exact:true}).click();await page.getByRole('heading',{name:/Conexiones/}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.locator('canvas.neural-canvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('.landing-home-panel')?.style.opacity==='1');
  await noOverflow(page,'mobile landing');await page.screenshot({path:path.join(out,'landing-mobile.png'),fullPage:true});
  await navigate(page,'fundamentals',/Conecta con/);
  await noOverflow(page,'mobile login');await enter(page);await page.getByRole('heading',{name:'Aprende experimentando',exact:true}).waitFor();
  await noOverflow(page,'mobile neuron');await page.getByRole('tab',{name:/Visión por filtros/}).click();await page.getByRole('heading',{name:'Un filtro que recorre tu dibujo',exact:true}).waitFor();
  await noOverflow(page,'mobile convolution');await page.screenshot({path:path.join(out,'fundamentals-mobile.png'),fullPage:true});
  await navigate(page,'laboratory','Laboratorio neuronal');await noOverflow(page,'mobile laboratory');
  assert.equal(await page.locator('.lab-inspector').evaluate(el=>getComputedStyle(el).position),'static');
  checks.push('session restore, logout, private-route gate and 390px layouts');

  const reduced=await makePage({reducedMotion:'reduce'});await reduced.goto(origin,{waitUntil:'networkidle'});await reduced.getByRole('button',{name:'Movimiento reducido',exact:true}).waitFor();
  assert.ok(await reduced.getByRole('button',{name:'Amplificar señal',exact:true}).isDisabled());
  const fallback=await makePage();await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args)}});
  await fallback.goto(origin,{waitUntil:'networkidle'});await fallback.getByRole('img',{name:'Vista estática de la red neuronal. WebGL no está disponible.',exact:true}).waitFor();
  checks.push('reduced motion and WebGL fallback');
  assert.deepEqual(errors,[],'no unhandled browser errors');
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors,screenshots:out},null,2));
} finally {await browser.close();}

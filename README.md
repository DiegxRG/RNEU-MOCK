# NeuroLab Enterprise

Laboratorio educativo de redes neuronales con React, TypeScript y Tailwind CSS. La plataforma empresarial es simulada; el motor Feedforward calcula propagaciones, pérdida, gradientes, entrenamiento SGD y predicciones en el navegador.

## Ejecutar en Windows

Requisito: Node.js 24.12 o posterior. Desde tu propia terminal PowerShell:

```powershell
cd "C:\Users\Diego Ramos\Projects-TxDx\RNEU-MOCK"
npm install
npm run dev
```

Si las dependencias ya están instaladas, basta con `npm run dev`. El arrancador usa IPv4, verifica que la página inicial responda por HTTP y muestra la dirección exacta, normalmente `http://127.0.0.1:5173/`. Si el puerto está ocupado, Vite usa otro disponible y el arrancador muestra el puerto real. Mantén esa terminal abierta; al finalizar, detén el servidor con `Ctrl+C`.

Para abrir automáticamente la dirección verificada en tu navegador:

```powershell
npm run dev:open
```

Para elegir otro puerto manualmente:

```powershell
npm run dev -- --port 5174
```

La vista local debe iniciarse desde la terminal del usuario: un servidor abierto en un entorno de ejecución aislado puede ocupar un puerto sin ser accesible desde el navegador del escritorio.

### Si el navegador rechaza la conexión

Comprueba que la terminal de `npm run dev` sigue abierta y no ha regresado al prompt. Usa exactamente el enlace del mensaje `servidor HTTP verificado`, incluido su puerto; evita sustituir `127.0.0.1` por `localhost` porque este último también puede resolverse a IPv6.

Desde una segunda terminal puedes comprobar las tres direcciones locales sin modificar ninguna configuración:

```powershell
npm run diagnose
# Si el servidor eligió otro puerto, por ejemplo 5174:
npm run diagnose -- --port 5174
```

`ECONNREFUSED` significa que esa dirección no está aceptando la conexión. `EACCES` o `EPERM` señalan una restricción de acceso del proceso que ejecuta el diagnóstico. Para revisar el fallo, conserva tanto la salida del arranque como la del diagnóstico.

## Comprobar el proyecto

```powershell
npm test
npm run build
npm run demo:engine
```

Las pruebas del motor comprueban cálculo manual, gradientes mediante diferencias finitas, estabilidad numérica, entrenamiento XOR reproducible y separación de datos. `build` comprueba tipos TypeScript y genera la aplicación en `dist/`.

## Recorrido principal

1. Abre la portada (`#/home`), entra al acceso demo y pulsa «Completar cuenta demo». Después entra al laboratorio y explora la red inicial.
2. Selecciona una neurona para ver sus pesos, suma, activación y gradientes.
3. Ejecuta una época o entrena la red completa.
4. Consulta Evaluación para revisar el conjunto de prueba y probar entradas nuevas.
5. Registra un modelo y exporta sus resultados desde Modelos o Reportes.

Los proyectos y checkpoints se guardan en IndexedDB, por navegador y origen. Cambiar de puerto cambia el origen y muestra un espacio local diferente. Usa el mismo puerto para recuperar los mismos datos. Al recargar o cerrar una pestaña el cálculo se detiene; se puede continuar desde el último checkpoint guardado.

Fundamentos ofrece una neurona entrenable, convolución sobre píxeles editables, una celda recurrente con memoria ajustable y un duelo generativo escalar. Las misiones incluyen preguntas con explicación y guardan el progreso en este navegador. El entrenamiento principal corresponde a redes Feedforward para clasificación binaria. Los roles y el acceso son controles de demostración y no constituyen autenticación multiusuario.

## Interfaz y simulación visual

La interfaz usa Tailwind CSS y tarjetas translúcidas con ayudas contextuales: pasa el cursor, enfoca o pulsa el icono «i». Esc cierra la explicación. El laboratorio separa configuración, red e inspector en áreas de una cuadrícula adaptable. Los laterales permanecen visibles al desplazarse en escritorio y permiten desplazamiento interno si superan el alto de la ventana. En pantallas pequeñas se apilan, la configuración se puede desplegar y el diagrama admite desplazamiento horizontal.

GSAP anima las partículas de propagación y retropropagación con auras radiales, estelas expansivas y ondas al llegar a cada capa; Motion gestiona transiciones y contadores. «Ver ciclo» permite recorrer las etapas sin entrenar. La velocidad guiada predeterminada (0,5×) publica una época cada 200 ms; «Muy lenta» (0,25×) lo hace cada 400 ms. También hay velocidades 1×, 2× y 4×. Cambian la cadencia de cálculo y presentación, conservando la secuencia matemática y la semilla. Las partículas ilustran el flujo; los valores del inspector y las métricas proceden del motor real. Las animaciones de partículas se pausan cuando el diagrama queda fuera de la vista o la pestaña está oculta, y respetan la preferencia de movimiento reducido.

Recharts presenta pérdida, exactitud, distribución de clases, histogramas de variables y pesos, estados de ejecución y comparación de resultados. La frontera de decisión interpola las probabilidades calculadas sobre una cuadrícula para datasets de dos variables. Los gráficos del entrenamiento reciben los checkpoints en vivo. El resumen muestra indicadores globales y las ejecuciones recientes; las listas extensas incluyen paginación. Evaluación añade precisión, sensibilidad y F1 para la clase 1; las razones indefinidas se muestran como «—».

Las pruebas incluyen estadísticas, las operaciones de Fundamentos y el worker: las cinco velocidades producen los mismos pesos y métricas, y pausar, continuar o cancelar conserva los límites de los checkpoints. La compilación divide las vistas para cargar su código cuando se solicita.

## Portada y acceso de demostración

La portada está en `#/home` y el formulario en `#/login`. Cuenta de ejemplo: **demo@neurolab.local**, clave **neuro-demo**. El formulario permite completar estos datos y elegir un perfil. La sesión demo se guarda en sessionStorage sin la clave; cerrar sesión conserva los proyectos de IndexedDB. Las rutas del espacio muestran el acceso demo cuando no hay sesión.

La dirección visual conserva la inspiración inmersiva de [PHOTON — A.I & Creative Experience](https://www.behance.net/gallery/131959357/PHOTON-AI-Creative-Experience). La portada representa una red neuronal artificial de cinco capas (3–5–7–5–1), 21 neuronas y 90 conexiones. Sus señales recorren las capas en propagación y regresan durante la retropropagación ilustrada. Esta escena conceptual se genera con geometría procedural y shaders WebGL; el cálculo verificable del modelo se explora en el laboratorio.

La red ocupa la mayor parte de la portada y comparte un fondo animado de conexiones e impulsos. Al abrir el acceso, la escena conserva su estado y se desplaza para dar paso al formulario de cristal con entrada escalonada de campos. Los controles de movimiento se muestran al pasar el cursor por la escena o enfocarlos con el teclado; en dispositivos táctiles permanecen disponibles. Pausar detiene tanto la red como el fondo. No se descargan modelos ni texturas externos. Si WebGL falla, se presenta una proyección estática. La preferencia de movimiento reducido detiene las animaciones automáticas y simplifica la transición de acceso.

## Comprobación visual automatizada

Después de compilar, ejecuta `npm run test:ui`. Requiere el Chromium correspondiente a Playwright (`npx playwright install chromium`) o una ruta compatible indicada en `NEUROLAB_BROWSER_EXECUTABLE`. Las pruebas sirven los archivos de `dist/` directamente al navegador aislado sin servidor ni solicitudes externas. Verifican la red WebGL, controles ocultos y accesibles al enfocar, pausa y giro, continuidad de la escena al abrir el acceso demo, lecciones, entrenamiento, paneles fijos, vistas de 390 px, movimiento reducido y alternativa sin WebGL. Las capturas y el informe quedan en `tmp/ui/`.

## Habilidades

La selección y la verificación de habilidades están descritas en [docs/SKILLS.md](docs/SKILLS.md).

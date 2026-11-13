# Habilidades para NeuroLab

Seleccion revisada el 12 de noviembre de 2026. Las 11 habilidades nuevas estan instaladas en el proyecto; `find-skills` ya estaba disponible globalmente. El usuario completo las descargas desde su terminal. La verificacion local acepta los dos formatos de UI/UX Pro Max: referencias separadas o contenido integrado en `SKILL.md`.

## Instalacion

Desde una terminal con acceso a Internet, en la raiz del proyecto:

```powershell
node scripts/install-skills.mjs
```

El script instala en el proyecto para Codex, conserva copias existentes y verifica archivos esenciales. No instala para otros agentes ni usa instalacion global. Requiere Node.js >= 22.20, npm/npx, Git y Python 3, ya presentes en el equipo durante la revision. No instala frameworks, navegadores ni dependencias del futuro producto.

El instalador usa Node.js directamente y no depende de ejecutar archivos `.ps1`. No es necesario cambiar la politica de PowerShell del equipo. Estos son los comandos individuales equivalentes para Windows:

```powershell
npx.cmd --yes skills add https://github.com/anthropics/skills --skill frontend-design doc-coauthoring webapp-testing --agent codex --copy --yes
npx.cmd --yes skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines vercel-react-best-practices vercel-composition-patterns --agent codex --copy --yes
npx.cmd --yes skills add https://github.com/wshobson/agents --skill architecture-patterns architecture-decision-records typescript-advanced-types javascript-testing-patterns --agent codex --copy --yes
npx.cmd --yes ui-ux-pro-max-cli init --ai codex
```

UI/UX Pro Max usa su instalador oficial para incluir scripts y bases CSV. No basta con copiar `SKILL.md`. Sus guias pueden estar en archivos de referencia separados o integradas como secciones de `SKILL.md`; el verificador admite ambas variantes y exige contenido. Si una plantilla apunta explicitamente a una referencia externa, ese archivo debe existir. La plantilla instalada incluye Quick Reference, Common Rules for Professional UI y Pre-Delivery Checklist dentro de `SKILL.md`.

Para inspeccionar la seleccion o verificar su presencia sin descargar nada:

```powershell
node scripts/install-skills.mjs --plan
node scripts/install-skills.mjs --verify
```

`Ready` significa cabecera, archivos esenciales y guias requeridas presentes; no certifica la calidad del contenido, la exactitud de sus ejemplos ni la disponibilidad de Playwright. El informe de una instalacion queda en `tmp/skills-install-report.json`. Si todas estan disponibles, ejecutar nuevamente el instalador actualiza el informe sin descargar nada. Conservar el `skills-lock.json` que genere Skills CLI para registrar las fuentes instaladas. La primera instalacion consulta las versiones publicadas en ese momento; no se presenta como una restauracion de versiones fijadas.

## Responsabilidades complementarias

| Habilidad | Fuente | Uso en NeuroLab |
| --- | --- | --- |
| find-skills | [Vercel](https://github.com/vercel-labs/skills) | Buscar una habilidad adicional cuando exista una necesidad concreta. |
| frontend-design | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Direccion visual: composicion, tipografia, jerarquia y personalidad del laboratorio. |
| ui-ux-pro-max | [NextLevelBuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Fundamentos y consultas de UX, paletas, graficos, accesibilidad y consistencia. |
| web-design-guidelines | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Auditoria de interfaz, foco, formularios y navegacion. |
| vercel-react-best-practices | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Rendimiento de React, renders y carga de componentes. |
| vercel-composition-patterns | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | Arquitectura de componentes y controles reutilizables. |
| architecture-patterns | [wshobson](https://github.com/wshobson/agents/tree/main/plugins/backend-development/skills/architecture-patterns) | Separacion del dominio, casos de uso y adaptadores; patrones backend cuando apliquen. |
| architecture-decision-records | [wshobson](https://github.com/wshobson/agents/tree/main/plugins/documentation-generation/skills/architecture-decision-records) | Registrar decisiones, alternativas y consecuencias. |
| typescript-advanced-types | [wshobson](https://github.com/wshobson/agents/tree/main/plugins/javascript-typescript/skills/typescript-advanced-types) | Contratos de datos, arquitectura neuronal, eventos y estados. |
| javascript-testing-patterns | [wshobson](https://github.com/wshobson/agents/tree/main/plugins/javascript-typescript/skills/javascript-testing-patterns) | Pruebas de calculos, reglas y transiciones con herramientas adecuadas al proyecto. |
| webapp-testing | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Pruebas de los recorridos y observacion de la aplicacion en el navegador. |
| doc-coauthoring | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring) | Requisitos, especificaciones, manuales y revision de comprension. |

Vercel y Anthropic son las fuentes oficiales de sus respectivas habilidades. NextLevelBuilder y wshobson son proyectos comunitarios. Las cifras de instalaciones del directorio se consultaron como una senal de adopcion, no como garantia de calidad.

## Como aplicarlas sin contradicciones

1. Requisitos y decisiones: partir de los PDF y las instrucciones del usuario; documentar cualquier adaptacion del alcance. Consultar doc-coauthoring y ADR segun la tarea, aprovechando el contexto existente.
2. Arquitectura: mantener pequeno el nucleo matematico, las reglas y el almacenamiento. No incorporar microservicios, backend, colas reales o DDD complejo solo porque una habilidad los mencione.
3. Diseno: frontend-design dirige la identidad visual. UI/UX Pro Max aporta criterios de interaccion, legibilidad y recomendaciones; no impone un segundo sistema visual. Crear un unico conjunto de tokens y componentes para el producto.
4. Implementacion: composition-patterns organiza los componentes; React Best Practices revisa rendimiento. Aplicar solamente reglas compatibles con las versiones y herramientas elegidas. Las recomendaciones de Next.js no obligan a abandonar Vite.
5. Logica: usar tipos claros y validacion en ejecucion. Las habilidades de TypeScript no sustituyen comprobar dimensiones, valores finitos, particiones de datos y transiciones del entrenamiento.
6. Verificacion: pruebas matematicas pequenas con resultados conocidos y comprobacion numerica de gradientes; luego flujo de usuario y revision visual en distintos tamanos. web-design-guidelines revisa codigo; webapp-testing comprueba comportamiento. Evitar duplicar pruebas.
7. Documentacion: explicar calculos didacticos y escenarios simulados, limitaciones y procedimientos de demostracion. Ninguna habilidad seleccionada sustituye la verificacion matematica con fuentes y casos conocidos.

No cargar todas las habilidades completas en cada tarea. Leer la pertinente y sus referencias necesarias. Las instrucciones del usuario y del proyecto prevalecen frente a ejemplos o flujos genericos de una habilidad. Su presencia no autoriza desplegar, enviar mensajes ni instalar herramientas ajenas al alcance.

## Criterio visual de trabajo

Antes de construir pantallas: definir publico, tareas, jerarquia de informacion y una direccion visual coherente. Despues: implementar una pantalla representativa, observar capturas reales y corregirla antes de extender su lenguaje al resto.

Evaluar tipografia, densidad, espacios, contraste, foco, responsive, estados vacios y de error, legibilidad de graficos y utilidad de la animacion neuronal. Los movimientos deben explicar cambios de valores y recorridos; respetar movimiento reducido.

Una habilidad es un conjunto de instrucciones y recursos, no otro modelo. Instalar una de Anthropic o una compatible con Antigravity no convierte Codex en esos productos ni garantiza por si sola un buen resultado visual.

## Lo que no se instala por ahora

- Colecciones completas con cientos de habilidades: agregarian solapamientos y tareas ajenas al laboratorio.
- Instrucciones especificas de marketing, comercio, pagos, blockchain o aplicaciones moviles.
- Nuevas copias de PDF, documentos, presentaciones y Figma: ya hay capacidades disponibles para esos formatos.
- Habilidades de PyTorch, GPU o despliegue empresarial: el alcance actual es una simulacion educativa en navegador; se evaluaran si cambia.
- Otra habilidad llamada frontend-design de un autor distinto: evitar colisiones de nombre y direcciones visuales simultaneas.

## Fuentes de instalacion

- [Skills CLI: opciones y alcance por proyecto](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).
- [Directorio de Anthropic](https://skills.sh/anthropics/skills).
- [Directorio de Vercel](https://skills.sh/vercel-labs/agent-skills).
- [UI/UX Pro Max: instalador y requisitos](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
- [Coleccion y compatibilidad de wshobson](https://github.com/wshobson/agents).

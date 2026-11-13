import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { InfoTip } from './components/InfoTip.tsx';
import { Activity, ArrowUpRight, BookOpen, Boxes, ChartNoAxesCombined, ChevronDown, ChevronRight, Database, FileChartColumn, FlaskConical, FolderOpen, LayoutDashboard, Menu, Network, Settings2, ShieldCheck, LogOut, Home, X } from 'lucide-react';
import { LabProvider, useLab } from './hooks/useLab.tsx';
const Laboratory = lazy(() => import('./features/Laboratory.tsx').then(module => ({default:module.Laboratory})));
const Dashboard = lazy(() => import('./features/Dashboard.tsx').then(module => ({default:module.Dashboard})));
const Datasets = lazy(() => import('./features/WorkspaceViews.tsx').then(module => ({default:module.Datasets})));
const Projects = lazy(() => import('./features/WorkspaceViews.tsx').then(module => ({default:module.Projects})));
const TrainingHistory = lazy(() => import('./features/WorkspaceViews.tsx').then(module => ({default:module.TrainingHistory})));
const Evaluation = lazy(() => import('./features/ResultsViews.tsx').then(module => ({default:module.Evaluation})));
const Models = lazy(() => import('./features/ResultsViews.tsx').then(module => ({default:module.Models})));
const Reports = lazy(() => import('./features/ResultsViews.tsx').then(module => ({default:module.Reports})));
const Administration = lazy(() => import('./features/ResultsViews.tsx').then(module => ({default:module.Administration})));
const Fundamentals = lazy(() => import('./features/Fundamentals.tsx').then(module => ({default:module.Fundamentals})));
import { roleLabels, type Role } from './domain/lab.ts';
import { Badge, Button } from './components/ui.tsx';
import { readSession, saveSession, type DemoSession } from './lib/session.ts';
const Landing = lazy(() => import('./features/Landing.tsx').then(module=>({default:module.Landing})));

const routes=[
  {id:'dashboard',name:'Resumen',icon:LayoutDashboard,section:'workspace'},
  {id:'projects',name:'Proyectos',icon:FolderOpen,section:'workspace'},
  {id:'datasets',name:'Datasets',icon:Database,section:'experiment'},
  {id:'laboratory',name:'Laboratorio neuronal',icon:Network,section:'experiment'},
  {id:'training',name:'Entrenamientos',icon:Activity,section:'experiment'},
  {id:'evaluation',name:'Evaluación',icon:ChartNoAxesCombined,section:'results'},
  {id:'models',name:'Registro de modelos',icon:Boxes,section:'results'},
  {id:'reports',name:'Reportes',icon:FileChartColumn,section:'results'},
  {id:'fundamentals',name:'Fundamentos',icon:BookOpen,section:'learn'},
  {id:'administration',name:'Administración',icon:Settings2,section:'learn'},
];

function Shell({onLogout}:{onLogout:()=>void}) {
  const {state,project,ready,notice,setNotice,storageError,selectProject,setRole}=useLab();
  const readRoute=()=>location.hash.replace(/^#\/?/,'')||'home';
  const [route,setRoute]=useState(readRoute),[mobileOpen,setMobileOpen]=useState(false);
  useEffect(()=>{const listener=()=>{setRoute(readRoute());setMobileOpen(false);window.scrollTo(0,0)};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener)},[]);
  const current=routes.find(item=>item.id===route);
  useEffect(()=>{if(current)document.title=`${current.name} · NeuroLab`},[current]);
  const views:Record<string,React.ReactNode>={dashboard:<Dashboard/>,projects:<Projects/>,datasets:<Datasets/>,laboratory:<Laboratory/>,training:<TrainingHistory/>,evaluation:<Evaluation/>,models:<Models/>,reports:<Reports/>,fundamentals:<Fundamentals/>,administration:<Administration/>};
  return <div className="min-h-screen"><a href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus()}} className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-primary px-4 py-3 text-white focus:not-sr-only">Saltar al contenido</a>
    {mobileOpen&&<button className="fixed inset-0 z-30 bg-sidebar/40 lg:hidden" aria-label="Cerrar navegación" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-[224px] flex-col bg-sidebar text-white transition-transform lg:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'}`}>
      <a href="#/laboratory" className="flex h-[78px] items-center gap-3 px-6"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Network size={23} strokeWidth={1.6}/></span><span className="text-[22px] font-semibold tracking-tight">NeuroLab<span className="mt-0.5 block text-[10px] font-normal tracking-[0.13em] text-white/50">Laboratorio de aprendizaje</span></span></a>
      <div className="mx-4 mb-5 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5"><div className="flex items-center gap-2 text-xs font-medium text-white/85"><FlaskConical size={14} className="text-[#a4b9ff]"/>Entorno de demostración</div><p className="mt-1.5 text-[10px] leading-relaxed text-white/45">Explora, experimenta y aprende.</p></div>
      <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">{routes.map((item,index)=><div key={item.id} className={index>0&&routes[index-1].section!==item.section?'pt-4':''}><a href={`#/${item.id}`} aria-current={route===item.id?'page':undefined} className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${route===item.id?'bg-white/11 font-medium text-white':'text-white/55 hover:bg-white/5 hover:text-white'}`}><item.icon size={17} strokeWidth={1.7} className={route===item.id?'text-[#a4b9ff]':''}/><span className="flex-1">{item.name}</span>{route===item.id&&<span className="h-1.5 w-1.5 rounded-full bg-[#a4b9ff]"/>}</a></div>)}</nav>
      <div className="sidebar-help mx-4 mb-4 rounded-xl bg-white/5 p-4"><BookOpen size={17} className="mb-2 text-white/65"/><p className="text-xs font-medium">¿Tu primera red neuronal?</p><a href="#/fundamentals" className="mt-2 flex items-center gap-2 text-[11px] text-white/50 hover:text-white">Empieza por los fundamentos<ArrowUpRight size={12}/></a></div><div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-[10px] text-white/35"><span>NeuroLab Enterprise</span><span>v0.1</span></div>
    </aside>
    <div className="lg:ml-[224px]"><header className="app-topbar flex min-h-[70px] flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-5 py-3 md:px-8"><div className="flex min-w-0 items-center gap-3"><button onClick={()=>setMobileOpen(true)} className="rounded-lg p-2 lg:hidden" aria-label="Abrir navegación" aria-expanded={mobileOpen}><Menu size={20}/></button><span className="hidden text-xs text-muted-foreground sm:inline">Workspace</span><ChevronRight size={12} className="hidden text-muted-foreground sm:inline"/><select aria-label="Proyecto activo" value={project.id} onChange={event=>selectProject(event.target.value)} className="max-w-60 bg-transparent text-sm font-semibold outline-none">{state.projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="flex items-center gap-3"><a href="#/home" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Volver a la portada"><Home size={17}/></a><Badge tone="green" className="hidden sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-success"/>Cálculo local</Badge><div className="h-5 w-px bg-border"/><label className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15}/><span className="sr-only">Rol de demostración</span><select aria-label="Rol de demostración" value={state.role} onChange={event=>setRole(event.target.value as Role)} className="max-w-36 bg-transparent text-xs font-medium text-foreground">{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">NL</span><button onClick={onLogout} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar sesión de demostración" title="Cerrar sesión de demostración"><LogOut size={17}/></button></div></header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1800px] px-4 py-6 outline-none md:px-7 md:py-7 xl:px-8">{storageError&&<p role="alert" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">{storageError}</p>}{!ready?<div className="flex min-h-96 items-center justify-center gap-3 text-sm text-muted-foreground"><FlaskConical size={20}/>Recuperando tu laboratorio…</div>:<AnimatePresence mode="wait" initial={false}><motion.div key={route} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.2,ease:"easeOut"}}><Suspense fallback={<div role="status" className="chart-empty">Preparando la vista…</div>}>{views[route]??<div><h1 className="text-xl font-semibold">Esta pantalla no existe</h1><a href="#/laboratory" className="mt-4 inline-block text-primary">Volver al laboratorio</a></div>}</Suspense></motion.div></AnimatePresence>}</main>
      <footer className="no-print mx-4 flex flex-wrap justify-between gap-2 border-t border-border py-4 text-[11px] text-muted-foreground md:mx-8"><span>Plataforma simulada · cálculo neuronal verificable</span><span className="inline-flex items-center gap-1">Datos guardados en este navegador<InfoTip title="Almacenamiento local">Los proyectos y checkpoints se guardan en IndexedDB para esta dirección. Recargar pausa el cálculo; puedes continuar desde el último checkpoint guardado.</InfoTip></span></footer>
    </div>
    {notice&&<div role="status" className="no-print fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-40px)] items-start gap-4 rounded-xl border border-border bg-white p-4 text-sm shadow-lg"><p className="max-w-md leading-relaxed">{notice}</p><button onClick={()=>setNotice('')} className="rounded p-1 text-muted-foreground" aria-label="Cerrar mensaje"><X size={16}/></button></div>}
  </div>;
}

function Portal() {
  const [session,setSession]=useState<DemoSession|null>(readSession);
  const readRoute=()=>location.hash.replace(/^#\/?/,'')||'home';
  const [route,setRoute]=useState(readRoute);
  const {setRole}=useLab();
  useEffect(()=>{const update=()=>{setRoute(readRoute());window.scrollTo(0,0)};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[]);
  const enter=(role:Role)=>{const next:DemoSession={name:'Explorador',role};saveSession(next);setSession(next);setRole(role);location.hash='/'+(routes.some(item=>item.id===route)?route:'dashboard');};
  const logout=()=>{saveSession(null);setSession(null);location.hash='/home';};
  return <Suspense fallback={<div className="portal-loading" role="status"><Network size={28}/>Preparando NeuroLab…</div>}>{route==='home'||route==='login'||!session?<Landing login={route!=='home'} onEnter={enter}/>:<Shell onLogout={logout}/>}</Suspense>;
}

export default function App(){return <MotionConfig reducedMotion="user"><LabProvider><Portal/></LabProvider></MotionConfig>}

import type { Role } from '../domain/lab.ts';
const KEY='neurolab-demo-session-v1';
export interface DemoSession {name:string;role:Role}
export function readSession():DemoSession|null {
  try {const value=JSON.parse(sessionStorage.getItem(KEY)??'null');return value&&value.name==='Explorador'&&['owner','reader','admin'].includes(value.role)?value:null;}catch{return null;}
}
export function saveSession(session:DemoSession|null) {
  try{if(session)sessionStorage.setItem(KEY,JSON.stringify(session));else sessionStorage.removeItem(KEY);}catch{/* Session remains available in memory when browser storage is unavailable. */}
}

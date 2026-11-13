import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../lib/utils.ts';

export function usePagination<T>(items: readonly T[], size = 8, resetKey = '') {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, pageSize: size, total: items.length, onPage: setPage };
}

export function Pagination({ page, pages, total, pageSize, onPage, label = 'registros' }: { page: number; pages: number; total: number; pageSize: number; onPage: (value: number) => void; label?: string }) {
  if (!total) return null;
  const candidates = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a,b) => a-b);
  return <nav aria-label={`Paginación de ${label}`} className="pagination no-print">
    <p className="text-xs text-muted-foreground">{(page-1)*pageSize+1}–{Math.min(total,page*pageSize)} de <strong className="font-medium text-foreground">{total}</strong> {label}</p>
    <div className="flex items-center gap-1">
      <button className="page-button hidden sm:inline-flex" aria-label="Primera página" disabled={page===1} onClick={()=>onPage(1)}><ChevronsLeft size={14}/></button>
      <button className="page-button" aria-label="Página anterior" disabled={page===1} onClick={()=>onPage(page-1)}><ChevronLeft size={14}/></button>
      {candidates.map((value,index)=><span key={value} className="inline-flex items-center gap-1">{index>0&&value-candidates[index-1]>1&&<span className="px-1 text-xs text-muted-foreground">…</span>}<button className={cn('page-button',page===value&&'is-active')} aria-label={`Página ${value}`} aria-current={page===value?'page':undefined} onClick={()=>onPage(value)}>{value}</button></span>)}
      <button className="page-button" aria-label="Página siguiente" disabled={page===pages} onClick={()=>onPage(page+1)}><ChevronRight size={14}/></button>
      <button className="page-button hidden sm:inline-flex" aria-label="Última página" disabled={page===pages} onClick={()=>onPage(pages)}><ChevronsRight size={14}/></button>
    </div>
  </nav>;
}

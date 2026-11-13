import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Info } from 'lucide-react';
import { cn } from '../lib/utils.ts';

export function InfoTip({ title, children, className }: { title: string; children: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), tooltip = useRef<HTMLDivElement>(null);
  const pinned = useRef(false), delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();
  const show = () => { if (delay.current) clearTimeout(delay.current); setOpen(true); };
  const leave = () => { if (!pinned.current) delay.current = setTimeout(() => setOpen(false), 160); };
  const close = () => { pinned.current = false; setOpen(false); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect(), box = tooltip.current?.getBoundingClientRect();
      if (!rect || !box) return;
      const x = Math.max(12, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - 12));
      const below = rect.bottom + 10;
      const y = below + box.height < window.innerHeight - 12 ? below : Math.max(12, rect.top - box.height - 10);
      setPosition({ x, y });
    };
    place();
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) close(); };
    document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => () => { if (delay.current) clearTimeout(delay.current); }, []);
  return <>
    <button ref={trigger} type="button" className={cn('info-trigger', className)} aria-label={`Información sobre ${title}`} aria-describedby={open ? id : undefined} aria-expanded={open}
      onPointerEnter={show} onPointerLeave={leave} onFocus={show} onBlur={leave}
      onClick={() => { if (pinned.current) close(); else { pinned.current = true; show(); } }}><Info size={14} aria-hidden="true"/></button>
    {typeof document !== 'undefined' && createPortal(<AnimatePresence>{open && <motion.div ref={tooltip} id={id} role="tooltip" className="info-popover" style={{ left: position?.x ?? 0, top: position?.y ?? 0, visibility: position ? 'visible' : 'hidden' }} initial={{ opacity: 0, y: reduce ? 0 : 4, scale: reduce ? 1 : 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onPointerEnter={show} onPointerLeave={leave}>
      <strong className="mb-2 block text-sm font-semibold text-foreground">{title}</strong><p className="text-xs leading-relaxed text-muted-foreground">{children}</p><span className="mt-3 block text-[10px] text-muted-foreground/70">Pulsa Esc para cerrar</span>
    </motion.div>}</AnimatePresence>, document.body)}
  </>;
}

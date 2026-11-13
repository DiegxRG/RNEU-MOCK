import { Children, isValidElement, useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, animate, useReducedMotion } from 'motion/react';
import { cn } from '../lib/utils.ts';
import { InfoTip } from './InfoTip.tsx';
import { helpFor } from '../lib/help.ts';

const buttonVariants = cva('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40', { variants: { variant: {
  default: 'bg-primary text-white hover:bg-primary-hover',
  outline: 'border border-border bg-white text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
} }, defaultVariants: { variant: 'default' } });
export function Button({ className, variant, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : '').join('');
}
function headingOf(node: ReactNode): string {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; title?: string }>(child)) continue;
    if (typeof child.type === 'string' && /^h[1-6]$/.test(child.type)) return textOf(child.props.children);
    const nested = headingOf(child.props.children); if (nested) return nested;
  }
  return '';
}
export function Card({ className, children, help, infoTitle, ...props }: HTMLAttributes<HTMLDivElement> & {help?: string; infoTitle?: string}) {
  const title = infoTitle || headingOf(children) || 'Panel del laboratorio';
  return <div className={cn('glass-card', className)} {...props}><InfoTip title={title} className="card-help">{help || helpFor(title)}</InfoTip>{children}</div>;
}
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red'; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium', { neutral: 'bg-muted text-muted-foreground', blue: 'bg-primary/8 text-primary', green: 'bg-success/10 text-success', amber: 'bg-warning/10 text-warning', red: 'bg-danger/10 text-danger' }[tone], className)}>{children}</span>;
}
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn('min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-muted disabled:text-muted-foreground', className)} {...props} />; }
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn('min-h-10 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-muted', className)} {...props} />; }
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) { return <div className="min-w-0 space-y-1.5"><div className="flex items-center justify-between gap-1"><label htmlFor={htmlFor} className="block text-xs font-semibold text-muted-foreground">{label}</label><InfoTip title={label}>{hint||helpFor(label)}</InfoTip></div>{children}{hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}</div>; }
export function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><h3 className="font-semibold">{title}</h3><div className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{children}</div></div>; }
export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) { return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2.5"><h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1><InfoTip title={title}>{helpFor(title)}</InfoTip></div><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>{children && <div className="flex flex-wrap gap-2">{children}</div>}</div>; }

export function AnimatedNumber({ value, digits = 0, suffix = '', className }: { value: number; digits?: number; suffix?: string; className?: string }) {
  const [shown,setShown]=useState(value);
  const reduce=useReducedMotion();
  useEffect(()=>{ if(reduce){setShown(value);return;} const controls=animate(shown,value,{duration:0.32,ease:'easeOut',onUpdate:setShown});return()=>controls.stop(); },[value,reduce]);
  return <motion.span className={className} aria-label={`${value.toFixed(digits)}${suffix}`}>{shown.toLocaleString('es-PE',{minimumFractionDigits:digits,maximumFractionDigits:digits})}{suffix}</motion.span>;
}

export function SectionTitle({ title, help, children }: { title: string; help?: string; children?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2"><h2 className="panel-title">{title}</h2><InfoTip title={title}>{help||helpFor(title)}</InfoTip>{children}</div>;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const number = (value: number, digits = 4) => Number.isFinite(value) ? value.toLocaleString('es-PE', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
export const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
export const date = (value: string) => new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

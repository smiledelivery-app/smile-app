import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border border-[#e4e9e5] bg-white text-[#153a2b] rounded-none', className)} {...props} />;
}

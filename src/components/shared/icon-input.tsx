import type { ComponentProps, ElementType } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface IconInputProps extends ComponentProps<typeof Input> {
  icon: ElementType<LucideProps>;
  iconClassName?: string;
}

export function IconInput({ icon: Icon, className, iconClassName, ...props }: IconInputProps) {
  return (
    <div className="relative flex items-center w-full">
      <Icon className={cn("absolute start-3 h-5 w-5 text-muted-foreground", iconClassName)} />
      <Input className={cn("ps-10", className)} {...props} />
    </div>
  );
}
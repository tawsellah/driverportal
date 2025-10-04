import * as React from 'react';
import type { ComponentProps, ElementType } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface IconInputProps extends ComponentProps<'input'> {
  icon: ElementType<LucideProps>;
  iconClassName?: string;
}

const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon: Icon, className, iconClassName, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <Icon className={cn("absolute start-3 h-5 w-5 text-muted-foreground", iconClassName)} />
        <Input ref={ref} className={cn("ps-10", className)} {...props} />
      </div>
    );
  }
);
IconInput.displayName = 'IconInput';

export { IconInput };

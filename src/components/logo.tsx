import { CarFront } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-primary text-primary-foreground p-2 rounded-md">
        <CarFront className="h-6 w-6" />
      </div>
      <span className="text-xl font-semibold font-headline text-foreground">
        DriveOnboard
      </span>
    </div>
  );
}

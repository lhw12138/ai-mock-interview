import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

    return (
      <div
        ref={ref}
        className={cn("h-2 w-full overflow-hidden rounded-full bg-white/10", className)}
        {...props}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };

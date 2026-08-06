import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status is never carried by color alone here — every usage pairs the badge
// with an icon, per the QIDMA design review's Color/Inclusive-color finding.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-teal-100 bg-teal-50 text-teal-800",
        success: "border-emerald-100 bg-emerald-50 text-emerald-700",
        info: "border-blue-100 bg-blue-50 text-blue-700",
        warning: "border-amber-100 bg-amber-50 text-amber-700",
        destructive: "border-rose-100 bg-rose-50 text-rose-700",
        neutral: "border-slate-200 bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Sizes follow Apple HIG's mobile touch-target minimums (44pt default,
// 28pt floor) — every size below stays at or above that floor, "default"
// meets the recommended default. See the QIDMA design review, "Improvements
// #1: touch targets."
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 border border-destructive/20",
        outline: "border border-input bg-card hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted",
        subtle: "bg-teal-50 text-teal-800 border border-teal-100 hover:bg-teal-100",
      },
      size: {
        default: "h-11 px-4 py-2.5 [&_svg]:size-4",
        sm: "h-9 rounded-lg px-3 text-xs [&_svg]:size-3.5",
        lg: "h-12 rounded-xl px-6 text-base [&_svg]:size-5",
        icon: "h-11 w-11 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

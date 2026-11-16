import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs hover:shadow active:scale-[0.98] font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs active:scale-[0.98] font-semibold",
        outline:
          "border border-border bg-card hover:bg-muted text-foreground shadow-xs active:scale-[0.98] font-medium",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98] font-semibold",
        ghost:
          "hover:bg-muted hover:text-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "bg-accent text-accent-foreground shadow-xs hover:bg-accent/90 active:scale-[0.98]",
        glass:
          "bg-card/80 backdrop-blur-md border border-border/70 text-foreground hover:bg-card shadow-xs active:scale-[0.98]",
        sidebar:
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "sidebar-active":
          "bg-primary text-primary-foreground font-semibold shadow-xs",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-9 px-3.5 text-xs font-semibold rounded-xl",
        lg: "h-11 px-6 text-sm font-semibold rounded-xl",
        xl: "h-12 px-8 text-base font-semibold rounded-xl",
        icon: "h-9 w-9 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

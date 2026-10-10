import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all duration-200 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-accent-hover hover:shadow-focus-glow active:bg-accent-active active:translate-y-px active:scale-[0.99]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-px active:scale-[0.99]",
        outline:
          "border border-border/20 bg-surface-2 text-foreground hover:bg-surface-3 hover:border-border/30 active:translate-y-px active:scale-[0.99]",
        secondary:
          "bg-surface-2 text-foreground border border-border/20 hover:bg-surface-3 hover:border-border/30 active:translate-y-px active:scale-[0.99]",
        ghost:
          "text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.08] active:translate-y-px active:scale-[0.99]",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30 active:translate-y-px active:scale-[0.99]",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 px-3 py-2 text-sm",
        lg: "h-[52px] px-5 py-3 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

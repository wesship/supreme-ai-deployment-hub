import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-border/50 bg-surface-2 px-3.5 py-2.5",
          "text-base text-foreground placeholder:text-muted-foreground",
          "transition-all duration-150 ease-in-out",
          "hover:border-border",
          "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-focus-glow",
          "disabled:cursor-not-allowed disabled:bg-muted/10 disabled:text-muted-foreground",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

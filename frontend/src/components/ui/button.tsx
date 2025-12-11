import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-0",
  {
    variants: {
      variant: {
        default: "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950",
        destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
        outline: "bg-stone-100 text-stone-900 hover:bg-stone-200 active:bg-stone-300",
        secondary: "bg-stone-200 text-stone-900 hover:bg-stone-300 active:bg-stone-400",
        ghost: "text-stone-700 hover:bg-stone-100 active:bg-stone-200",
        link: "text-stone-900 underline-offset-4 hover:underline",
        primary: "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700",
        success: "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        xs: "h-7 px-2 text-xs",
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

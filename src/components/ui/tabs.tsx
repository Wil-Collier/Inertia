"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col relative",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      className={cn(
        "absolute left-0 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] transition-all duration-300 ease-in-out z-0 pointer-events-none",
        "group-data-[variant=default]/tabs-list:bg-background group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:shadow-md group-data-[variant=default]/tabs-list:h-[calc(100%-6px)] group-data-[variant=default]/tabs-list:top-[3px]",
        "group-data-[variant=line]/tabs-list:bg-primary group-data-[variant=line]/tabs-list:bottom-0 group-data-[variant=line]/tabs-list:h-0.5",
        className
      )}
      {...props}
    />
  )
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      <TabsIndicator />
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "gap-1.5 rounded-md px-3 py-1 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground hover:text-foreground data-[active]:text-foreground data-[active]:font-semibold relative inline-flex h-full flex-1 items-center justify-center whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 z-10 transform-gpu",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("text-sm flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

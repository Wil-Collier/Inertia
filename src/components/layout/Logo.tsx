import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

/**
 * The core brand icon: Velocity lines + the leading "I"
 */
export function BrandIcon({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center select-none shrink-0", className)}>
      {/* Velocity Lines - Tapered "Tear Drop" shapes with Gradients & Idle Animation */}
      <div className="flex flex-col gap-[3.5px] -mr-[1px] translate-y-[0.5px]">
        <VelocityLine 
          id="v-top" 
          w={10} 
          h={1.5} 
          className="self-end translate-x-[2px] animate-kinetic-idle" 
        />
        <VelocityLine 
          id="v-mid" 
          w={20} 
          h={2.5} 
          className="self-end animate-kinetic-idle [animation-delay:200ms]" 
        />
        <VelocityLine 
          id="v-bot" 
          w={14} 
          h={2} 
          className="self-end -translate-x-[1px] animate-kinetic-idle [animation-delay:400ms]" 
        />
      </div>
      
      <span className="text-xl font-black uppercase tracking-tighter italic text-foreground leading-none">
        I
      </span>
    </div>
  )
}

/**
 * Custom SVG Teardrop Line with Gradient & Bloom
 */
function VelocityLine({ w, h, id, className }: { w: number; h: number; id: string; className?: string }) {
  return (
    <svg 
      width={w} 
      height={h + 1} 
      viewBox={`0 0 ${w} ${h + 1}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={id} x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path 
        d={`M ${w - h/2} 0.5 A ${h/2} ${h/2} 0 0 1 ${w - h/2} ${h + 0.5} L ${h/2} ${h * 0.75 + 0.5} A ${h/4} ${h/4} 0 0 1 ${h/2} ${h * 0.25 + 0.5} Z`} 
        fill={`url(#${id})`}
      />
    </svg>
  )
}

/**
 * Full Logo with Text
 */
export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <BrandIcon />
      <span className="text-xl font-black uppercase tracking-tighter italic text-foreground leading-none ml-[1px] pr-1">
        NERTIA
      </span>
    </div>
  )
}

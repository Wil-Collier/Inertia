import { useTheme } from "@/hooks/useTheme"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  const desktopOffset: NonNullable<ToasterProps["offset"]> = {
    top: "calc(env(safe-area-inset-top, 0px) + 24px)",
    right: "calc(env(safe-area-inset-right, 0px) + 24px)",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    left: "calc(env(safe-area-inset-left, 0px) + 24px)",
  }

  const mobileOffset: NonNullable<ToasterProps["mobileOffset"]> = {
    top: "calc(env(safe-area-inset-top, 0px) + 16px)",
    right: "calc(env(safe-area-inset-right, 0px) + 16px)",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    left: "calc(env(safe-area-inset-left, 0px) + 16px)",
  }

  const style: React.CSSProperties = {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
    ...props.style,
  } as React.CSSProperties

  return (
    <Sonner
      theme={theme === "system" ? "system" : theme === "dark" ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      offset={props.offset ?? desktopOffset}
      mobileOffset={props.mobileOffset ?? mobileOffset}
      style={style}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

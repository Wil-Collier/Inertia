import { toast } from "sonner"

let updateToastId: string | number | undefined

function promptForUpdate(registration: ServiceWorkerRegistration) {
  if (updateToastId !== undefined) {
    return
  }

  updateToastId = toast.info("Update available. Reload to run the latest build.", {
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: {
      label: "Update",
      onClick: () => {
        const waitingWorker = registration.waiting
        if (!waitingWorker) {
          void registration.update()
          return
        }

        let didReload = false
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (didReload) {
            return
          }
          didReload = true
          window.location.reload()
        })

        waitingWorker.postMessage({ type: "SKIP_WAITING" }, [])
      },
    },
    onDismiss: () => {
      updateToastId = undefined
    },
  })
}

export function registerPwaUpdates() {
  if (!("serviceWorker" in navigator)) {
    return
  }

  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptForUpdate(registration)
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing
        if (!installingWorker) {
          return
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            promptForUpdate(registration)
          }
        })
      })

      return registration
    })
    .catch((error: unknown) => {
      console.error("Service worker registration failed:", error)
    })
}

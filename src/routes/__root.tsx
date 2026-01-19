import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Layout } from "@/components/layout/Layout"

import { PageLoader } from "@/components/ui/PageLoader"
import { Suspense } from "react"
import { AppInitializer } from "@/components/AppInitializer"
import { DevSeedingHandler } from "@/components/DevSeedingHandler"

export const Route = createRootRoute({
  component: () => (
    <>
      <DevSeedingHandler />
      <AppInitializer>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </Layout>
      </AppInitializer>

    </>
  ),
})

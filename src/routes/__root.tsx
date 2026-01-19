import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Layout } from "@/components/layout/Layout"

import { PageLoader } from "@/components/ui/PageLoader"
import { Suspense } from "react"
import { AppInitializer } from "@/components/AppInitializer"
import { DevSeedingHandler } from "@/components/DevSeedingHandler"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"

export const Route = createRootRoute({
  component: () => (
    <>
      <DevSeedingHandler />
      <AppInitializer>
        <Layout>
          <PageErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </Layout>
      </AppInitializer>

    </>
  ),
})

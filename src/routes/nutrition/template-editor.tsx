import { createFileRoute } from "@tanstack/react-router"
import { TemplateEditorPage } from "@/pages/TemplateEditorPage"
import { z } from "zod"

export const Route = createFileRoute("/nutrition/template-editor")({
  validateSearch: z.object({
    templateId: z.string().optional(),
  }),
  component: TemplateEditorPage,
})

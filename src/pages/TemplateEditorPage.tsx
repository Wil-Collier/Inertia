import { useSearch } from "@tanstack/react-router"
import { TemplateEditorScreen } from "@/features/nutrition/screens/TemplateEditorScreen"
import { Route } from "@/routes/nutrition/template-editor"

export function TemplateEditorPage() {
  const { templateId } = useSearch({ from: Route.fullPath })

  return <TemplateEditorScreen templateId={templateId} />
}

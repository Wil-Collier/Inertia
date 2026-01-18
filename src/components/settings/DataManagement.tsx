import { useRef } from "react"
import { Download, Upload, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface DataManagementProps {
  onExport: () => void
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearAll: () => void
}

export function DataManagement({
  onExport,
  onImport,
  onClearAll,
}: DataManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export Data (JSON)
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Import Data
        </Button>

        <Button
          variant="destructive"
          className="w-full justify-start"
          onClick={onClearAll}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All Data
        </Button>
      </CardContent>
    </Card>
  )
}

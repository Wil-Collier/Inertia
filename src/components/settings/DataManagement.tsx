import { useRef, useState } from "react"
import { Download, Upload, Trash2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

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
  const [showExportWarning, setShowExportWarning] = useState(false)

  const handleExportClick = () => {
    setShowExportWarning(true)
  }

  const handleConfirmExport = () => {
    onExport()
    setShowExportWarning(false)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportClick}
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

      {/* Export Warning Dialog */}
      <Dialog open={showExportWarning} onOpenChange={setShowExportWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Export Data
            </DialogTitle>
            <DialogDescription>
              Your backup file will contain all your data in plain text, including:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Workout history and personal records</li>
              <li>Nutrition logs and food diary</li>
              <li>Body weight measurements</li>
              <li>Custom exercises and templates</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              This file is <strong>not encrypted</strong>. Store it securely and avoid 
              sharing it with others.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExportWarning(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

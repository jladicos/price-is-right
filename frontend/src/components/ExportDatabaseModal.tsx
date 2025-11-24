/**
 * Export Database Modal - Disaster Recovery Backup Tool
 *
 * Provides a user interface for exporting the entire game database to a JSON file.
 * This is a critical disaster recovery feature that allows hosts to create backups
 * before important events or after significant data changes.
 *
 * Security Features:
 * - Session tokens are NEVER exported (users must re-login after import)
 * - Requires host authentication via session token in localStorage
 *
 * Export Contents:
 * - All players (excluding session tokens)
 * - Game state configuration
 * - Export metadata (version, timestamp)
 *
 * File Format:
 * - JSON file named: price-is-right-backup-YYYY-MM-DD.json
 * - Versioned format (currently v1.0) for import validation
 * - Content-Disposition header triggers automatic download
 *
 * Usage:
 * 1. Host clicks "Export Database" button on admin page
 * 2. Modal confirms the export action
 * 3. API call to GET /api/admin/export
 * 4. Browser downloads timestamped JSON file
 * 5. Success toast shows filename
 *
 * Best Practices:
 * - Export before major game events
 * - Export after bulk player changes
 * - Store backups securely offsite
 * - Test restore process on development environment
 */

import { useState } from "react";
import { showToast } from "../utils/toast";
import { useAuthStore } from "../store/authStore";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "./ui/dialog";
import { Button, Text, VStack } from "@chakra-ui/react";
import { Alert } from "./ui/alert";

interface ExportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDatabaseModal({
  isOpen,
  onClose,
}: ExportDatabaseModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (!sessionToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("http://localhost:3001/api/admin/export", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ||
        `price-is-right-backup-${new Date().toISOString().split("T")[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast({
        title: "Database exported",
        description: `Backup saved as ${filename}`,
        type: "success",
      });

      onClose();
    } catch (err) {
      showToast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose()}
      size="md"
    >
      <DialogContent>
        <DialogHeader>Export Database</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack gap="4" align="stretch">
            <Text>
              This will export the entire database to a JSON file that you can
              download.
            </Text>

            <Alert status="info">
              The export includes all players and game state. Session tokens are
              not included for security.
            </Alert>
          </VStack>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            colorPalette="blue"
            onClick={handleExport}
            loading={isExporting}
          >
            Export & Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

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

import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';

interface ExportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDatabaseModal({ isOpen, onClose }: ExportDatabaseModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:3001/api/admin/export', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ||
        `price-is-right-backup-${new Date().toISOString().split('T')[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Database exported',
        description: `Backup saved as ${filename}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onClose();
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Export Database</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text>This will export the entire database to a JSON file that you can download.</Text>

            <Alert status="info">
              <AlertIcon />
              The export includes all players and game state. Session tokens are not included for
              security.
            </Alert>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isExporting}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleExport} isLoading={isExporting}>
            Export & Download
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

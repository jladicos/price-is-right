/**
 * Import Database Modal - Disaster Recovery Restore Tool
 *
 * Provides a user interface for importing a previously exported database backup.
 * This is a DESTRUCTIVE operation that replaces ALL existing data in the database.
 *
 * ⚠️ WARNING: This operation:
 * - DELETES all existing players
 * - DELETES all existing game state
 * - REPLACES with imported data
 * - Cannot be undone (transaction-based, all-or-nothing)
 *
 * Security & Validation:
 * - Requires host authentication via session token
 * - Validates JSON file format
 * - Checks export version compatibility (currently supports v1.0)
 * - Validates required fields (version, players, gameState)
 * - Transaction-based import ensures atomicity (no partial imports)
 *
 * Import Process:
 * 1. Host selects JSON file (accepts .json only)
 * 2. File validated on client side (type check)
 * 3. File uploaded to POST /api/admin/import
 * 4. Server validates structure and version
 * 5. Database replaced via transaction
 * 6. Success callback refreshes player table and game status
 *
 * Post-Import Effects:
 * - Session tokens NOT restored (users must re-login)
 * - Autoincrement sequences reset to prevent ID conflicts
 * - Player table automatically refreshed
 * - Game status automatically refreshed
 *
 * Use Cases:
 * - Recovering from database corruption
 * - Restoring after accidental data deletion
 * - Moving game state between environments
 * - Rolling back to a previous state
 *
 * Best Practices:
 * - ALWAYS test imports on development environment first
 * - Create a fresh export before importing (for rollback)
 * - Verify export file contents before importing
 * - Communicate downtime to users during import
 * - Confirm all users are logged out before importing
 */

import { useState, useRef } from 'react';
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
  Input,
  FormControl,
  FormLabel,
  Box,
} from '@chakra-ui/react';

interface ImportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportDatabaseModal({ isOpen, onClose, onSuccess }: ImportDatabaseModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a JSON file',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a backup file to import',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsImporting(true);
    try {
      // Read file contents
      const fileContents = await selectedFile.text();
      const data = JSON.parse(fileContents);

      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:3001/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();

      toast({
        title: 'Database imported',
        description: `Successfully imported ${result.playersImported} players and ${result.gameStateImported} game state entries`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleModalClose = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Import Database</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="warning">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">WARNING: This will delete all existing data!</Text>
                <Text fontSize="sm">
                  The current database will be completely replaced with the imported data.
                </Text>
              </Box>
            </Alert>

            <FormControl>
              <FormLabel>Select backup file</FormLabel>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                disabled={isImporting}
              />
              {selectedFile && (
                <Text fontSize="sm" mt={2} color="gray.600">
                  Selected: {selectedFile.name}
                </Text>
              )}
            </FormControl>

            <Text fontSize="sm" color="gray.600">
              Select a JSON backup file exported from this application.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleModalClose} isDisabled={isImporting}>
            Cancel
          </Button>
          <Button colorScheme="red" onClick={handleImport} isLoading={isImporting}>
            Import & Replace
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

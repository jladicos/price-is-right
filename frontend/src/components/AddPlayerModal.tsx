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
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  HStack,
  useToast,
  Alert,
  AlertIcon,
  Text,
  Code,
  Image,
  Box,
} from '@chakra-ui/react';
import type { PlayerRole } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPlayerModal({ isOpen, onClose, onSuccess }: AddPlayerModalProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isCreating, setIsCreating] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<PlayerRole>('player');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdAccessCode, setCreatedAccessCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (JPG, PNG, or GIF)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Client-side validation
    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('First name and last name are required');
      return;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('role', role);
      if (selectedFile) {
        formData.append('photo', selectedFile);
      }

      const response = await fetch('http://localhost:3001/api/players', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create player');
      }

      const data = await response.json();

      // Show the generated access code
      setCreatedAccessCode(data.player.accessCode);

      toast({
        title: 'Player created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create player';
      setValidationError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFirstName('');
    setLastName('');
    setRole('player');
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
    setCreatedAccessCode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleCopyCode = () => {
    if (createdAccessCode) {
      navigator.clipboard.writeText(createdAccessCode);
      toast({
        title: 'Access code copied',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add New Player</ModalHeader>
        <ModalCloseButton />
        {!createdAccessCode ? (
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <VStack spacing={4} align="stretch">
                {validationError && (
                  <Alert status="error">
                    <AlertIcon />
                    {validationError}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Role</FormLabel>
                  <Select value={role} onChange={(e) => setRole(e.target.value as PlayerRole)}>
                    <option value="player">Player</option>
                    <option value="audience">Audience</option>
                    <option value="host">Host</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Photo (Optional)</FormLabel>
                  <Box
                    borderWidth={2}
                    borderStyle="dashed"
                    borderColor="gray.300"
                    borderRadius="md"
                    p={4}
                    textAlign="center"
                  >
                    {previewUrl ? (
                      <VStack spacing={3}>
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          maxH="150px"
                          objectFit="contain"
                          borderRadius="md"
                        />
                        <Button onClick={handleClearPhoto} size="sm" variant="ghost">
                          Remove Photo
                        </Button>
                      </VStack>
                    ) : (
                      <VStack spacing={2}>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={handleFileSelect}
                          display="none"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          colorScheme="blue"
                          variant="outline"
                          size="sm"
                        >
                          Upload Photo
                        </Button>
                        <Text fontSize="xs" color="gray.500">
                          JPG, PNG, or GIF (max 5MB)
                        </Text>
                      </VStack>
                    )}
                  </Box>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="green"
                isLoading={isCreating}
                isDisabled={!firstName.trim() || !lastName.trim()}
              >
                Create Player
              </Button>
            </ModalFooter>
          </form>
        ) : (
          <>
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Alert status="success">
                  <AlertIcon />
                  Player created successfully!
                </Alert>

                <Text>
                  <strong>
                    {firstName} {lastName}
                  </strong>{' '}
                  has been added as a {role}.
                </Text>

                <div>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Access Code
                  </Text>
                  <HStack>
                    <Code fontSize="2xl" px={4} py={2} flex={1} textAlign="center">
                      {createdAccessCode}
                    </Code>
                    <Button onClick={handleCopyCode} colorScheme="blue" size="sm">
                      Copy
                    </Button>
                  </HStack>
                </div>

                <Text fontSize="sm" color="gray.600">
                  Share this code with the player so they can log in.
                </Text>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleClose} colorScheme="blue">
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

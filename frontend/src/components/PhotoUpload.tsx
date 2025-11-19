import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Image,
  VStack,
  HStack,
  Text,
  useToast,
  Input,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';

interface PhotoUploadProps {
  playerId: number;
  currentPhoto?: string;
  onUploadSuccess?: (filename: string) => void;
}

export function PhotoUpload({ playerId, currentPhoto, onUploadSuccess }: PhotoUploadProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPhotoUrl = currentPhoto
    ? `http://localhost:3001/images/players/${currentPhoto}`
    : 'http://localhost:3001/images/players/default.jpg';

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

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`http://localhost:3001/api/players/${playerId}/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
      }

      const data = await response.json();

      toast({
        title: 'Photo uploaded',
        description: 'Player photo has been updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Clear selection
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onUploadSuccess) {
        onUploadSuccess(data.filename);
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel>Player Photo</FormLabel>
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
                maxH="200px"
                objectFit="contain"
                borderRadius="md"
              />
              <HStack>
                <Button onClick={handleUpload} colorScheme="blue" isLoading={isUploading} size="sm">
                  Upload Photo
                </Button>
                <Button onClick={handleCancel} size="sm" variant="ghost">
                  Cancel
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack spacing={3}>
              {currentPhoto && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Current Photo
                  </Text>
                  <Image
                    src={currentPhotoUrl}
                    alt="Current photo"
                    maxH="150px"
                    objectFit="contain"
                    borderRadius="md"
                  />
                </Box>
              )}
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
                {currentPhoto ? 'Change Photo' : 'Upload Photo'}
              </Button>
              <Text fontSize="xs" color="gray.500">
                JPG, PNG, or GIF (max 5MB)
              </Text>
            </VStack>
          )}
        </Box>
      </FormControl>
    </VStack>
  );
}

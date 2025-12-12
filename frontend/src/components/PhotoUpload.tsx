import { useState, useRef } from "react";
import {
  Box,
  Button,
  Image,
  VStack,
  HStack,
  Text,
  Input,
} from "@chakra-ui/react";
import { Field } from "./ui/field";
import { useAuthStore } from "../store/authStore";
import { showToast } from "../utils/toast";
import { getPlayerPhotoUrl } from "../utils/imageUrls";

// API base URL for uploads
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface PhotoUploadProps {
  playerId: number;
  currentPhoto?: string;
  onUploadSuccess?: (filename: string) => void;
}

export function PhotoUpload({
  playerId,
  currentPhoto,
  onUploadSuccess,
}: PhotoUploadProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPhotoUrl = currentPhoto
    ? getPlayerPhotoUrl(currentPhoto)
    : getPlayerPhotoUrl("default.jpg");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showToast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, or GIF)",
        type: "error",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast({
        title: "File too large",
        description: "Please select an image under 5MB",
        type: "error",
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
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_BASE_URL}/players/${playerId}/photo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload photo");
      }

      const data = await response.json();

      showToast({
        title: "Photo uploaded",
        description: "Player photo has been updated",
        type: "success",
      });

      // Clear selection
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (onUploadSuccess) {
        onUploadSuccess(data.filename);
      }
    } catch (error) {
      showToast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload photo",
        type: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <VStack gap="4" align="stretch">
      <Field label="Player Photo">
        <Box
          borderWidth={2}
          borderStyle="dashed"
          borderColor="gray.300"
          borderRadius="md"
          p={4}
          textAlign="center"
        >
          {previewUrl ? (
            <VStack gap="3">
              <Image
                src={previewUrl}
                alt="Preview"
                maxH="200px"
                objectFit="contain"
                borderRadius="md"
              />
              <HStack>
                <Button
                  onClick={handleUpload}
                  colorPalette="blue"
                  loading={isUploading}
                  size="sm"
                >
                  Upload Photo
                </Button>
                <Button onClick={handleCancel} size="sm" variant="ghost">
                  Cancel
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack gap="3">
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
                colorPalette="blue"
                variant="outline"
                size="sm"
              >
                {currentPhoto ? "Change Photo" : "Upload Photo"}
              </Button>
              <Text fontSize="xs" color="gray.500">
                JPG, PNG, or GIF (max 5MB)
              </Text>
            </VStack>
          )}
        </Box>
      </Field>
    </VStack>
  );
}

import { useState, useRef } from "react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "./ui/dialog";
import {
  Button,
  Input,
  VStack,
  HStack,
  Text,
  Code,
  Image,
  Box,
} from "@chakra-ui/react";
import { Field } from "./ui/field";
import { NativeSelectRoot, NativeSelectField } from "./ui/native-select";
import { Alert } from "./ui/alert";
import type { PlayerRole } from "../../../backend/src/types/player";
import { useAuthStore } from "../store/authStore";
import { showToast } from "../utils/toast";

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPlayerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPlayerModalProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isCreating, setIsCreating] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<PlayerRole>("player");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdAccessCode, setCreatedAccessCode] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleClearPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Client-side validation
    if (!firstName.trim() || !lastName.trim()) {
      setValidationError("First name and last name are required");
      return;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());
      formData.append("role", role);
      if (selectedFile) {
        formData.append("photo", selectedFile);
      }

      const response = await fetch("http://localhost:3001/api/players", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create player");
      }

      const data = await response.json();

      // Show the generated access code
      setCreatedAccessCode(data.player.accessCode);

      showToast({
        title: "Player created",
        type: "success",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create player";
      setValidationError(errorMessage);
      showToast({
        title: "Error",
        description: errorMessage,
        type: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFirstName("");
    setLastName("");
    setRole("player");
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
    setCreatedAccessCode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleCopyCode = () => {
    if (createdAccessCode) {
      navigator.clipboard.writeText(createdAccessCode);
      showToast({
        title: "Access code copied",
        type: "success",
      });
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && handleClose()}
      size="lg"
    >
      <DialogContent>
        <DialogHeader>Add New Player</DialogHeader>
        <DialogCloseTrigger />
        {!createdAccessCode ? (
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <VStack gap="4" align="stretch">
                {validationError && (
                  <Alert status="error">{validationError}</Alert>
                )}

                <Field label="First Name" required>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </Field>

                <Field label="Last Name" required>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </Field>

                <Field label="Role" required>
                  <NativeSelectRoot>
                    <NativeSelectField
                      value={role}
                      onChange={(e) => setRole(e.target.value as PlayerRole)}
                    >
                      <option value="player">Player</option>
                      <option value="audience">Audience</option>
                      <option value="host">Host</option>
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field>

                <Field label="Photo (Optional)">
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
                          maxH="150px"
                          objectFit="contain"
                          borderRadius="md"
                        />
                        <Button
                          onClick={handleClearPhoto}
                          size="sm"
                          variant="ghost"
                        >
                          Remove Photo
                        </Button>
                      </VStack>
                    ) : (
                      <VStack gap="2">
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
                          Upload Photo
                        </Button>
                        <Text fontSize="xs" color="gray.500">
                          JPG, PNG, or GIF (max 5MB)
                        </Text>
                      </VStack>
                    )}
                  </Box>
                </Field>
              </VStack>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorPalette="green"
                loading={isCreating}
                disabled={!firstName.trim() || !lastName.trim()}
              >
                Create Player
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogBody>
              <VStack gap="4" align="stretch">
                <Alert status="success">Player created successfully!</Alert>

                <Text>
                  <strong>
                    {firstName} {lastName}
                  </strong>{" "}
                  has been added as a {role}.
                </Text>

                <div>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    Access Code
                  </Text>
                  <HStack>
                    <Code
                      fontSize="2xl"
                      px={4}
                      py={2}
                      flex={1}
                      textAlign="center"
                    >
                      {createdAccessCode}
                    </Code>
                    <Button
                      onClick={handleCopyCode}
                      colorPalette="blue"
                      size="sm"
                    >
                      Copy
                    </Button>
                  </HStack>
                </div>

                <Text fontSize="sm" color="gray.600">
                  Share this code with the player so they can log in.
                </Text>
              </VStack>
            </DialogBody>
            <DialogFooter>
              <Button onClick={handleClose} colorPalette="blue">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

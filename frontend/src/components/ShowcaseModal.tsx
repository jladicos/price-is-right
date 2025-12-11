import {
  DialogRoot,
  DialogContent,
  DialogBody,
  DialogCloseTrigger,
} from "./ui/dialog";
import { Box, Image, Text, VStack, HStack, Button } from "@chakra-ui/react";
import { getProductImageUrls } from "../utils/imageUrls";
import type { ShowcaseProduct } from "../store/gameStore";

interface ShowcaseModalProps {
  showcaseProducts: ShowcaseProduct[];
  showcaseNumber: 1 | 2;
  isOpen: boolean;
  onClose?: () => void; // Host only can close
  role: string; // 'host', 'player', or 'audience'
  currentProductIndex: number; // Synced from backend
  currentImageIndex: number; // Synced from backend
  onNavigate?: (productIndex: number, imageIndex: number) => void; // Host only
}

export function ShowcaseModal({
  showcaseProducts,
  showcaseNumber,
  isOpen,
  onClose,
  role,
  currentProductIndex,
  currentImageIndex,
  onNavigate,
}: ShowcaseModalProps) {
  if (!showcaseProducts || showcaseProducts.length === 0) {
    return null;
  }

  // Ensure indices are within bounds
  const safeProductIndex = Math.min(currentProductIndex, showcaseProducts.length - 1);
  const currentProduct = showcaseProducts[safeProductIndex];
  const imageUrls = getProductImageUrls(currentProduct.product.images);
  const safeImageIndex = Math.min(currentImageIndex, imageUrls.length - 1);

  const handlePrevProduct = () => {
    if (role !== "host" || !onNavigate) return;
    const newProductIndex = safeProductIndex > 0 ? safeProductIndex - 1 : showcaseProducts.length - 1;
    onNavigate(newProductIndex, 0); // Reset to first image when changing products
  };

  const handleNextProduct = () => {
    if (role !== "host" || !onNavigate) return;
    const newProductIndex = safeProductIndex < showcaseProducts.length - 1 ? safeProductIndex + 1 : 0;
    onNavigate(newProductIndex, 0); // Reset to first image when changing products
  };

  const handlePrevImage = () => {
    if (role !== "host" || !onNavigate) return;
    const newImageIndex = safeImageIndex > 0 ? safeImageIndex - 1 : imageUrls.length - 1;
    onNavigate(safeProductIndex, newImageIndex);
  };

  const handleNextImage = () => {
    if (role !== "host" || !onNavigate) return;
    const newImageIndex = safeImageIndex < imageUrls.length - 1 ? safeImageIndex + 1 : 0;
    onNavigate(safeProductIndex, newImageIndex);
  };

  const handleClose = () => {
    if (role === "host" && onClose) {
      onClose();
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open && role === "host" && onClose) {
          handleClose();
        }
      }}
      size="xl"
    >
      <DialogContent data-testid="showcase-modal">
        {/* Only show close button for host */}
        {role === "host" && <DialogCloseTrigger />}

        <DialogBody p={6}>
          <VStack gap={6} align="stretch">
            {/* Showcase Header */}
            <Text
              fontSize="3xl"
              fontWeight="bold"
              textAlign="center"
              color="pink.600"
              textTransform="uppercase"
              letterSpacing="wide"
              lineHeight="1.2"
            >
              Showcase {showcaseNumber}
            </Text>

            {/* Product Counter */}
            <Text
              fontSize="lg"
              textAlign="center"
              color="gray.600"
              fontWeight="medium"
            >
              Product {safeProductIndex + 1} of {showcaseProducts.length}
            </Text>

            {/* Product Name */}
            <Text
              fontSize="2xl"
              fontWeight="bold"
              textAlign="center"
              color="blue.600"
              textTransform="uppercase"
              letterSpacing="wide"
              lineHeight="1.3"
              data-testid="showcase-modal-product-name"
            >
              {currentProduct.product.name}
            </Text>

            {/* Image Display */}
            <Box
              position="relative"
              data-testid="showcase-modal-image-container"
            >
              {/* Main Image */}
              <Box
                width="100%"
                height="400px"
                borderRadius="lg"
                overflow="hidden"
                border="4px solid"
                borderColor="pink.500"
                boxShadow="2xl"
                bg="gray.100"
              >
                <Image
                  src={imageUrls[safeImageIndex]}
                  alt={`${currentProduct.product.name} - Image ${safeImageIndex + 1}`}
                  width="100%"
                  height="100%"
                  objectFit="contain"
                  data-testid="showcase-modal-image"
                />
              </Box>

              {/* Image Navigation Arrows (if multiple images) - Host only */}
              {imageUrls.length > 1 && role === "host" && (
                <>
                  <Button
                    position="absolute"
                    left="4"
                    top="50%"
                    transform="translateY(-50%)"
                    onClick={handlePrevImage}
                    size="lg"
                    colorPalette="pink"
                    borderRadius="full"
                    boxShadow="lg"
                    data-testid="showcase-modal-prev-image"
                  >
                    ←
                  </Button>
                  <Button
                    position="absolute"
                    right="4"
                    top="50%"
                    transform="translateY(-50%)"
                    onClick={handleNextImage}
                    size="lg"
                    colorPalette="pink"
                    borderRadius="full"
                    boxShadow="lg"
                    data-testid="showcase-modal-next-image"
                  >
                    →
                  </Button>
                </>
              )}

              {/* Image Counter */}
              {imageUrls.length > 1 && (
                <Box
                  position="absolute"
                  bottom="4"
                  left="50%"
                  transform="translateX(-50%)"
                  bg="blackAlpha.700"
                  color="white"
                  px={4}
                  py={2}
                  borderRadius="full"
                  fontSize="sm"
                  data-testid="showcase-modal-image-counter"
                >
                  Image {safeImageIndex + 1} / {imageUrls.length}
                </Box>
              )}
            </Box>

            {/* Product Navigation Buttons - Host only */}
            {role === "host" && (
              <HStack gap={4} justify="center">
                <Button
                  onClick={handlePrevProduct}
                  size="lg"
                  colorPalette="blue"
                  variant="outline"
                  data-testid="showcase-modal-prev-product"
                >
                  ← Previous Product
                </Button>
                <Button
                  onClick={handleNextProduct}
                  size="lg"
                  colorPalette="blue"
                  variant="outline"
                  data-testid="showcase-modal-next-product"
                >
                  Next Product →
                </Button>
              </HStack>
            )}
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

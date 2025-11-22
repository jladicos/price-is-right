import { useState } from 'react';
import { DialogRoot, DialogContent, DialogBody, DialogCloseTrigger } from './ui/dialog';
import { Box, Image, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { getProductImageUrls } from '../utils/imageUrls';

export interface Product {
  name: string;
  price: number;
  images: string[];
}

interface ProductModalProps {
  product: Product | null;
  productId: string | null;
  isOpen: boolean;
  onClose?: () => void; // Host only can close
  role: string; // 'host', 'player', or 'audience'
}

export function ProductModal({ product, productId, isOpen, onClose, role }: ProductModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!product || !productId) {
    return null;
  }

  const imageUrls = getProductImageUrls(product.images);

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : imageUrls.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < imageUrls.length - 1 ? prev + 1 : 0));
  };

  const handleClose = () => {
    if (role === 'host' && onClose) {
      onClose();
      setCurrentImageIndex(0); // Reset to first image
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open && role === 'host' && onClose) {
          handleClose();
        }
      }}
      size="md"
    >
      <DialogContent data-testid="product-modal">
        {/* Only show close button for host */}
        {role === 'host' && <DialogCloseTrigger />}

        <DialogBody p={6}>
          <VStack gap={4} align="stretch">
            {/* Product Name */}
            <Text
              fontSize="2xl"
              fontWeight="bold"
              textAlign="center"
              color="blue.600"
              textTransform="uppercase"
              letterSpacing="wide"
              lineHeight="1.3"
              data-testid="product-modal-name"
            >
              {product.name}
            </Text>

            {/* Image Display */}
            <Box position="relative" data-testid="product-modal-image-container">
              {/* Main Image */}
              <Box
                width="100%"
                height="300px"
                borderRadius="lg"
                overflow="hidden"
                border="4px solid"
                borderColor="blue.500"
                boxShadow="2xl"
                bg="gray.100"
              >
                <Image
                  src={imageUrls[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  width="100%"
                  height="100%"
                  objectFit="contain"
                  data-testid="product-modal-image"
                />
              </Box>

              {/* Navigation Arrows (if multiple images) */}
              {imageUrls.length > 1 && (
                <>
                  <Button
                    position="absolute"
                    left="4"
                    top="50%"
                    transform="translateY(-50%)"
                    onClick={handlePrevImage}
                    size="lg"
                    colorPalette="blue"
                    borderRadius="full"
                    boxShadow="lg"
                    data-testid="product-modal-prev"
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
                    colorPalette="blue"
                    borderRadius="full"
                    boxShadow="lg"
                    data-testid="product-modal-next"
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
                  data-testid="product-modal-counter"
                >
                  {currentImageIndex + 1} / {imageUrls.length}
                </Box>
              )}
            </Box>

            {/* Image Thumbnails (if multiple images) */}
            {imageUrls.length > 1 && (
              <HStack gap={2} justify="center" wrap="wrap">
                {imageUrls.map((url, index) => (
                  <Box
                    key={index}
                    width="60px"
                    height="60px"
                    borderRadius="md"
                    overflow="hidden"
                    border="3px solid"
                    borderColor={index === currentImageIndex ? 'blue.500' : 'gray.300'}
                    cursor="pointer"
                    onClick={() => setCurrentImageIndex(index)}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: 'blue.400',
                      transform: 'scale(1.05)',
                    }}
                    data-testid={`product-thumbnail-${index}`}
                  >
                    <Image
                      src={url}
                      alt={`${product.name} thumbnail ${index + 1}`}
                      width="100%"
                      height="100%"
                      objectFit="cover"
                    />
                  </Box>
                ))}
              </HStack>
            )}
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, VStack, Image, Text, IconButton } from "@chakra-ui/react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { getProductImageUrl } from "../utils/imageUrls";

export interface Product {
  name: string;
  price: number;
  images: string[];
}

export interface ShowcaseProduct {
  id: string;
  product: Product;
}

interface ProductInsetCardProps {
  // Single product mode (bidding rounds)
  product?: Product | null;
  productId?: string | null;
  // Showcase mode (multiple products)
  products?: ShowcaseProduct[];
  // Common props
  isVisible: boolean;
  showPrice?: boolean;
  price?: number; // For single product or total showcase value
  position?: "left" | "right";
}

export function ProductInsetCard({
  product,
  productId,
  products,
  isVisible,
  showPrice = false,
  price,
  position = "right",
}: ProductInsetCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we're in showcase mode (multiple products)
  const isShowcaseMode = products && products.length > 0;
  const hasMultipleProducts = isShowcaseMode && products.length > 1;

  // Get current product to display
  const currentProduct = isShowcaseMode
    ? products[currentIndex]?.product
    : product;
  const currentProductId = isShowcaseMode
    ? products[currentIndex]?.id
    : productId;

  // Auto-advance logic for showcase mode
  const startAutoAdvance = useCallback(() => {
    if (!hasMultipleProducts || !products) return;

    // Clear existing timer
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }

    // Set new timer for 5 seconds
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % products.length);
    }, 5000);

    autoAdvanceTimer.current = timer;
  }, [hasMultipleProducts, products]);

  // Start auto-advance when component mounts or index changes
  useEffect(() => {
    if (hasMultipleProducts) {
      startAutoAdvance();
    }

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [currentIndex, hasMultipleProducts, startAutoAdvance]);

  // Manual navigation handlers
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + products!.length) % products!.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % products!.length);
  };

  // Don't render if not visible or no product
  if (!isVisible || !currentProduct || !currentProductId) {
    return null;
  }

  // Use first image from product, with fallback for missing images
  const firstImageUrl = currentProduct.images?.[0]
    ? getProductImageUrl(currentProduct.images[0])
    : "";

  return (
    <Box
      position="fixed"
      top={{ base: "10px", lg: "20px" }}
      {...(position === "left" ? { left: { base: "10px", lg: "20px" } } : { right: { base: "10px", lg: "20px" } })}
      width={{ base: "125px", lg: "250px" }}
      bg="white"
      borderRadius="lg"
      boxShadow="2xl"
      border={{ base: "2px solid", lg: "3px solid" }}
      borderColor="blue.500"
      overflow="hidden"
      zIndex={100}
      data-testid="product-inset-card"
    >
      <VStack gap={0} align="stretch">
        {/* Product Image with Navigation Arrows */}
        <Box
          width="100%"
          height={{ base: "100px", lg: "200px" }}
          bg="gray.100"
          overflow="hidden"
          borderBottom={{ base: "2px solid", lg: "3px solid" }}
          borderColor="blue.500"
          position="relative"
        >
          <Image
            src={firstImageUrl}
            alt={currentProduct.name}
            width="100%"
            height="100%"
            objectFit="contain"
            data-testid="product-inset-image"
          />

          {/* Navigation Arrows - only show in showcase mode with multiple products */}
          {hasMultipleProducts && (
            <>
              <IconButton
                aria-label="Previous product"
                position="absolute"
                left="10px"
                top="50%"
                transform="translateY(-50%)"
                onClick={handlePrevious}
                size="sm"
                colorScheme="blue"
                variant="solid"
                opacity={0.9}
                _hover={{ opacity: 1 }}
                data-testid="carousel-prev-button"
              >
                <IoChevronBack size={24} />
              </IconButton>
              <IconButton
                aria-label="Next product"
                position="absolute"
                right="10px"
                top="50%"
                transform="translateY(-50%)"
                onClick={handleNext}
                size="sm"
                colorScheme="blue"
                variant="solid"
                opacity={0.9}
                _hover={{ opacity: 1 }}
                data-testid="carousel-next-button"
              >
                <IoChevronForward size={24} />
              </IconButton>
            </>
          )}
        </Box>

        {/* Product Name */}
        <Box bg="blue.500" p={{ base: 1, lg: 3 }}>
          <Text
            fontSize={{ base: "xs", lg: "lg" }}
            fontWeight="bold"
            textAlign="center"
            color="white"
            textTransform="uppercase"
            letterSpacing="wide"
            lineClamp={2}
            data-testid="product-inset-name"
          >
            {currentProduct.name}
          </Text>

          {/* Carousel indicator - show current position */}
          {hasMultipleProducts && (
            <Text
              fontSize="xs"
              textAlign="center"
              color="white"
              mt={1}
              opacity={0.8}
              data-testid="carousel-indicator"
            >
              {currentIndex + 1} / {products.length}
            </Text>
          )}
        </Box>

        {/* Product Price or Total Showcase Value - shown when winner is revealed */}
        {showPrice &&
          price != null &&
          typeof price === "number" &&
          isFinite(price) && (
            <Box bg="green.500" p={{ base: 2, lg: 4 }}>
              <Text
                fontSize={{ base: "md", lg: "2xl" }}
                fontWeight="bold"
                textAlign="center"
                color="white"
                data-testid="product-inset-price"
              >
                {price < 0 ? "-" : ""}$
                {Math.abs(price).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              {isShowcaseMode && (
                <Text
                  fontSize={{ base: "xs", lg: "sm" }}
                  textAlign="center"
                  color="white"
                  mt={1}
                  opacity={0.9}
                  data-testid="showcase-total-label"
                >
                  TOTAL VALUE
                </Text>
              )}
            </Box>
          )}
      </VStack>
    </Box>
  );
}

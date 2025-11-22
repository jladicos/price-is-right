import { Box, VStack, Image, Text } from '@chakra-ui/react';
import { getProductImageUrl } from '../utils/imageUrls';

export interface Product {
  name: string;
  price: number;
  images: string[];
}

interface ProductInsetCardProps {
  product: Product | null;
  productId: string | null;
  isVisible: boolean;
  showPrice?: boolean;
  price?: number;
}

export function ProductInsetCard({
  product,
  productId,
  isVisible,
  showPrice = false,
  price,
}: ProductInsetCardProps) {
  if (!isVisible || !product || !productId) {
    return null;
  }

  // Use first image from product, with fallback for missing images
  const firstImageUrl = product.images?.[0] ? getProductImageUrl(product.images[0]) : '';

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      width="250px"
      bg="white"
      borderRadius="lg"
      boxShadow="2xl"
      border="3px solid"
      borderColor="blue.500"
      overflow="hidden"
      zIndex={100}
      data-testid="product-inset-card"
    >
      <VStack gap={0} align="stretch">
        {/* Product Image */}
        <Box
          width="100%"
          height="200px"
          bg="gray.100"
          overflow="hidden"
          borderBottom="3px solid"
          borderColor="blue.500"
        >
          <Image
            src={firstImageUrl}
            alt={product.name}
            width="100%"
            height="100%"
            objectFit="contain"
            data-testid="product-inset-image"
          />
        </Box>

        {/* Product Name */}
        <Box bg="blue.500" p={3}>
          <Text
            fontSize="lg"
            fontWeight="bold"
            textAlign="center"
            color="white"
            textTransform="uppercase"
            letterSpacing="wide"
            data-testid="product-inset-name"
          >
            {product.name}
          </Text>
        </Box>

        {/* Product Price - shown when winner is revealed */}
        {showPrice && price != null && typeof price === 'number' && isFinite(price) && (
          <Box bg="green.500" p={4}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              textAlign="center"
              color="white"
              data-testid="product-inset-price"
            >
              {price < 0 ? '-' : ''}${Math.abs(price).toFixed(2)}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
}

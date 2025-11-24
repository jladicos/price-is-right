import { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../middleware/auth.js";
import { getProduct } from "../utils/products.js";

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/products/:productId
   * Get product details (name and images only, no price)
   * Authenticated users only
   */
  fastify.get<{
    Params: {
      productId: string;
    };
  }>(
    "/products/:productId",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const { productId } = request.params;

        const product = getProduct(productId);

        if (!product) {
          return reply.status(404).send({
            success: false,
            error: `Product not found: ${productId}`,
          });
        }

        // Return only name and images (exclude price for security)
        return reply.status(200).send({
          success: true,
          product: {
            name: product.name,
            images: product.images,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to get product",
        });
      }
    },
  );
};

export default productsRoutes;

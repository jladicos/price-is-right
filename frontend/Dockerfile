FROM node:22-alpine

WORKDIR /app

# Copy source code first
COPY . .

# Install dependencies
# Using --no-optional helps avoid some binary compatibility issues
RUN npm install

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]

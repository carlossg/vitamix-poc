# Vitamix Recommender - Cloud Run Container
# Google-native stack with passwordless authentication

FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies for Google Cloud SDKs
RUN apt-get update && apt-get install -y \
	python3 \
	make \
	g++ \
	&& rm -rf /var/lib/apt/lists/*

# Copy package files
COPY services/recommender/package*.json ./
COPY services/recommender/tsconfig.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy content files (needed for content-service.ts imports)
COPY content ./content

# Copy source code
COPY services/recommender/src ./src

# Build TypeScript
RUN npm install -D typescript @types/node @types/express @types/cors && \
	npx tsc && \
	npm uninstall typescript @types/node @types/express @types/cors

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
	CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application (using index-express.js)
CMD ["node", "dist/index-express.js"]

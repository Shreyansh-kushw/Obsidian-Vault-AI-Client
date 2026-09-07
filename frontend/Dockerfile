# ==========================================
# Stage 1: Build Frontend Assets
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build-time environment variables for Vite
ARG VITE_CLIENT_API_URL=""
ARG VITE_CLIENT_WS_URL=""
ENV VITE_CLIENT_API_URL=$VITE_CLIENT_API_URL
ENV VITE_CLIENT_WS_URL=$VITE_CLIENT_WS_URL

# Copy source code and build config
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY public/ ./public/
COPY src/ ./src/

# Compile TypeScript and bundle with Vite
RUN npm run build

# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

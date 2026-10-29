# Stage 1: Build static Astro site
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Install dependencies first (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build static site into /app/dist
COPY . .
RUN pnpm run build

# Stage 2: Lightweight Nginx static server (~25 MB)
FROM nginx:1.27-alpine AS runner

# Install curl for Coolify container healthchecks
RUN apk add --no-cache curl

# Copy custom Nginx config and built static files
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose both 80 (Nginx default) and 3000 (Coolify Nixpacks default)
EXPOSE 80 3000

CMD ["nginx", "-g", "daemon off;"]

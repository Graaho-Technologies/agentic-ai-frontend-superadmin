# ---------- Build Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --frozen-lockfile

# Copy all files
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle by `next build`, so they
# must be present at build time. Setting them on the container at runtime has no
# effect on the already-compiled bundle.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ENV=dev
ARG NEXT_PUBLIC_DEV_ML_API_BASE_URL
ARG NEXT_PUBLIC_PROD_ML_API_BASE_URL
ARG NEXT_PUBLIC_DEV_AI_BASE_URL
ARG NEXT_PUBLIC_DEMO_AI_BASE_URL
ARG NEXT_PUBLIC_PROD_AI_BASE_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV \
    NEXT_PUBLIC_DEV_ML_API_BASE_URL=$NEXT_PUBLIC_DEV_ML_API_BASE_URL \
    NEXT_PUBLIC_PROD_ML_API_BASE_URL=$NEXT_PUBLIC_PROD_ML_API_BASE_URL \
    NEXT_PUBLIC_DEV_AI_BASE_URL=$NEXT_PUBLIC_DEV_AI_BASE_URL \
    NEXT_PUBLIC_DEMO_AI_BASE_URL=$NEXT_PUBLIC_DEMO_AI_BASE_URL \
    NEXT_PUBLIC_PROD_AI_BASE_URL=$NEXT_PUBLIC_PROD_AI_BASE_URL

# Fail here, with a readable message, rather than part-way through the prerender.
RUN test -n "$NEXT_PUBLIC_API_BASE_URL" \
    || (echo "ERROR: build-arg NEXT_PUBLIC_API_BASE_URL is required (set the GitHub repo variable NEXT_PUBLIC_API_BASE_URL_DEV / _PROD)" && exit 1)

# Build the application
RUN npm run build

# ---------- Run Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

# Use a smaller base image with bun
FROM oven/bun:1.1.13-alpine

# Install OpenSSL
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Set npm registry for compatibility (optional, if needed)
RUN bun config set registry https://registry.npmmirror.com/

# Install dependencies (bun automatically uses bun.lockb)
RUN bun install --production

# Expose container port 3000
EXPOSE 3000

# Generate Prisma client and start app on container launch
CMD ["sh", "-c", "bunx prisma db push && bun start"]

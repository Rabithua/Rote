# Use a smaller base image
FROM node:22.15.0-alpine


# Install OpenSSL
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Generate Prisma client
RUN npm config set registry https://registry.npmmirror.com/

RUN npm install --omit=dev

# Expose container port 3000
EXPOSE 3000

# Install dependencies, compile Prisma client and start app on container launch
CMD ["sh", "-c", "npx prisma db push && npm start"]

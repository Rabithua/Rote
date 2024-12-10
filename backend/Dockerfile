# Use a smaller base image
FROM node:18-alpine

# Set working directory
WORKDIR /root/rote_node

# Copy project files
COPY ./ .

# Expose container port 3000
EXPOSE 3000

# Install dependencies, compile Prisma client and start app on container launch
CMD ["sh", "-c", "npm install --omit=dev && npx prisma db push && npm start"]
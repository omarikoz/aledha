FROM node:20-slim

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies cleanly
RUN npm install

# Copy application files
COPY . .

# Build client distribution bundle
RUN npm run build

# Expose port 3001 (configurable via PORT environment variable)
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/index.js"]

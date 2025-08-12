FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    sqlite

# Create directory for database and logs with proper permissions
RUN mkdir -p /data/db /app/logs /app/backups && \
    chown -R node:node /data /app/logs /app/backups

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    DB_PATH=/data/db/dmautomation.db

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY . .

# Set up cron job for database backup
RUN echo "0 0 * * * cd /app && node backup-db.js >> /app/logs/backup.log 2>&1" > /etc/crontabs/root

# Switch to non-root user
USER node

# Start the app
CMD ["node", "server.js"]

# Expose the port
EXPOSE 5000

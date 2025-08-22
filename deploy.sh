#!/bin/bash

# TurboDM Production Deployment Script
# This script deploys the TurboDM app to your VPS

set -e

echo "🚀 Starting TurboDM Production Deployment..."

# Configuration
DROPLET_IP="146.190.135.243"
DOMAIN="turbodm.pro"
APP_PATH="/var/www/turbodm-app"
BACKUP_PATH="/var/backups/turbodm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on local machine
if [[ $(hostname -I | grep -c "146.190.135.243") -eq 0 ]]; then
    print_status "Running deployment from local machine..."
    
    # Build the project locally
    print_status "Building project for production..."
    NODE_ENV=production npm run build
    
    # Create deployment package
    print_status "Creating deployment package..."
    tar -czf turbodm-app.tar.gz dist/ backend/ docker-compose.prod.yml Dockerfile nginx.conf package.json
    
    # Upload to server
    print_status "Uploading to server..."
    scp turbodm-app.tar.gz root@$DROPLET_IP:/tmp/
    
    # Execute deployment on server
    print_status "Executing deployment on server..."
    ssh root@$DROPLET_IP 'bash -s' < deploy.sh remote
    
    # Cleanup
    rm turbodm-app.tar.gz
    
    print_status "✅ Deployment completed!"
    print_status "🌐 Your TurboDM app should be available at: https://$DOMAIN/app"
    
else
    print_status "Running deployment on server..."
    
    # Create backup
    if [ -d "$APP_PATH" ]; then
        print_status "Creating backup..."
        mkdir -p $BACKUP_PATH
        cp -r $APP_PATH $BACKUP_PATH/turbodm-$(date +%Y%m%d_%H%M%S)
    fi
    
    # Create app directory
    mkdir -p $APP_PATH
    
    # Extract files
    print_status "Extracting application files..."
    cd $APP_PATH
    tar -xzf /tmp/turbodm-app.tar.gz
    
    # Stop existing containers if running
    print_status "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    
    # Build and start containers
    print_status "Building and starting containers..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    # Setup Nginx reverse proxy
    print_status "Configuring Nginx reverse proxy..."
    
    # Create nginx config for main server
    cat > /etc/nginx/sites-available/turbodm.pro << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration (you'll need to add your SSL certificates)
    # ssl_certificate /path/to/your/certificate.crt;
    # ssl_certificate_key /path/to/your/private.key;

    # For now, we'll handle HTTP only
    # You can set up SSL later with Let's Encrypt

    # Landing page (your existing setup)
    location / {
        # Proxy to your existing landing page
        try_files \$uri \$uri/ @landing;
    }

    location @landing {
        # Replace this with your actual landing page setup
        proxy_pass http://127.0.0.1:3000;  # Adjust port as needed
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # TurboDM App
    location /app {
        proxy_pass http://127.0.0.1:8080/app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support for real-time features
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # TurboDM API
    location /api {
        proxy_pass http://127.0.0.1:8080/api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Increase timeouts for long-running operations
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF
    
    # Enable the site
    ln -sf /etc/nginx/sites-available/turbodm.pro /etc/nginx/sites-enabled/
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    # Setup firewall
    print_status "Configuring firewall..."
    ufw allow 8080/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Wait for containers to be ready
    print_status "Waiting for containers to be ready..."
    sleep 30
    
    # Health check
    print_status "Performing health check..."
    if curl -f http://localhost:8080/app > /dev/null 2>&1; then
        print_status "✅ Application is running successfully!"
    else
        print_error "❌ Application health check failed"
        exit 1
    fi
    
    # Cleanup
    rm -f /tmp/turbodm-app.tar.gz
    
    print_status "🎉 TurboDM deployment completed successfully!"
    print_status "📱 App URL: https://$DOMAIN/app"
    print_status "🔧 API URL: https://$DOMAIN/api"
    
fi

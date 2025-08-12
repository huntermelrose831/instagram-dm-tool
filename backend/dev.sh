#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Instagram DM Tool - Development Server ===${NC}"
echo -e "${YELLOW}Setting up development environment...${NC}"

# Ensure required directories exist
echo "Creating required directories..."
mkdir -p logs
mkdir -p backups
mkdir -p data/db

# Check if package.json exists
if [ ! -f ./package.json ]; then
    echo -e "${RED}Error: package.json not found. Are you in the correct directory?${NC}"
    exit 1
fi

# Check if nodemon is installed
if [ ! -f ./node_modules/.bin/nodemon ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    
    # Check if install succeeded
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to install dependencies. Check npm-debug.log for details.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dependencies installed successfully.${NC}"
fi

# Run setup if needed
if [ ! -f ./.env ]; then
    echo -e "${YELLOW}Setting up environment...${NC}"
    node setup.js
    
    # Check if setup succeeded
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to set up environment. Check logs for details.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Environment setup completed.${NC}"
fi

# Check database file
DB_PATH=$(grep "DB_PATH" .env | cut -d '=' -f2 || echo "database/dmautomation.db")
if [ ! -f "$DB_PATH" ] && [ ! -f "database/dmautomation.db" ]; then
    echo -e "${YELLOW}Database file not found. It will be created automatically.${NC}"
fi

# Kill any existing nodemon processes
echo "Cleaning up any existing processes..."
pkill -f "nodemon server.js" || true

# Start the server with nodemon
echo -e "${GREEN}Starting server with nodemon...${NC}"
echo -e "${YELLOW}Server will restart automatically when changes are detected.${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server.${NC}"
echo ""

# Export NODE_ENV for development
export NODE_ENV=development

# Start the server with nodemon
./node_modules/.bin/nodemon server.js

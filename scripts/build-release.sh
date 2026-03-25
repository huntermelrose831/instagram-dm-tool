#!/bin/bash

# Instagram DM Tool - Release Build Script
# This script builds the app for all platforms

set -e

echo "🚀 Building Instagram DM Tool for all platforms..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist-electron
rm -rf dist

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate icons
echo "🎨 Generating application icons..."
npm run generate-icons

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Prepare backend
echo "🔧 Preparing backend..."
if [ -f "backend/package.json" ]; then
    echo "📦 Installing backend dependencies..."
    (cd backend && npm install --production)
    
    # Ensure backend is properly built/copied
    echo "🔧 Verifying backend dependencies..."
    if [ ! -d "backend/node_modules" ]; then
        echo "❌ Backend dependencies not installed properly"
        exit 1
    fi
    
    # Verify critical dependencies are installed
    if [ ! -d "backend/node_modules/dotenv" ]; then
        echo "❌ Error: dotenv not installed in backend"
        exit 1
    fi
    if [ ! -d "backend/node_modules/express" ]; then
        echo "❌ Error: express not installed in backend"
        exit 1
    fi
    echo "✅ Backend dependencies verified"
fi

# Build for all platforms
echo "📦 Building for all platforms..."
echo "This may take several minutes..."

# Build one platform at a time to avoid issues
echo "🐧 Building for Linux..."
npx electron-builder --linux

echo "🪟 Building for Windows..."
npx electron-builder --win

echo "⏭️ Skipping macOS build (requires macOS environment)..."

echo ""
echo "✅ Build complete!"
echo "=================================================="
echo "📁 Distribution files are in: ./dist-electron/"
echo ""
echo "📋 Files created:"
find dist-electron -name "*.exe" -o -name "*.dmg" -o -name "*.AppImage" -o -name "*.deb" | sort

echo ""
echo "🎉 Your Instagram DM Tool is ready for distribution!"
echo "📝 Next steps:"
echo "   1. Test the installers on different systems"
echo "   2. Update README-DISTRIBUTION.md with actual file names"
echo "   3. Create a download page or distribution platform"
echo "   4. Set up payment processing (if selling)"
echo "   5. Consider code signing for Windows/macOS"

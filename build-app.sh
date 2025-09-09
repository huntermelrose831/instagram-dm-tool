#!/bin/bash

echo "🚀 Building Instagram DM Tool for production..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf dist-electron

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the frontend
echo "🏗️ Building frontend..."
npm run build

# Install backend dependencies
if [ -f "backend/package.json" ]; then
    echo "📦 Installing backend dependencies..."
    (cd backend && npm install --production)

    # Ensure backend is properly built/copied
    echo "🔧 Preparing backend for packaging..."
    if [ ! -d "backend/node_modules" ]; then
        echo "❌ Backend dependencies not installed properly"
        exit 1
    fi
fi

# Build for your platform
echo "🔨 Building Electron app..."
case "$1" in
    "win")
        npm run build-electron-win
        echo "✅ Windows build complete! Check dist-electron folder."
        ;;
    "mac")
        npm run build-electron-mac
        echo "✅ macOS build complete! Check dist-electron folder."
        ;;
    "linux")
        npm run build-electron-linux
        echo "✅ Linux build complete! Check dist-electron folder."
        ;;
    *)
        echo "🖥️ Building for current platform..."
        npm run build-electron
        echo "✅ Build complete! Check dist-electron folder."
        ;;
	esac

echo "🎉 Build finished successfully!"
echo "📂 You can find your app in the dist-electron directory"

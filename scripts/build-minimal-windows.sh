#!/bin/bash

echo "🔧 Building Minimal Windows Version..."
echo "======================================"

# Create a minimal package.json for Windows build
cat > package-minimal.json << 'EOF'
{
  "name": "instagram-dm-tool",
  "version": "1.0.0",
  "description": "Instagram DM Tool - Minimal Windows Build",
  "main": "electron/main-simple.cjs",
  "scripts": {
    "build-win-minimal": "electron-builder --win --config.extraMetadata.main=electron/main-simple.cjs"
  },
  "build": {
    "appId": "com.instagramdmtool.minimal",
    "productName": "Instagram DM Tool",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron/main-simple.cjs",
      "electron/preload.cjs",
      "assets/icons/**/*"
    ],
    "win": {
      "icon": "assets/icons/icon-large.png",
      "target": [
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
EOF

# Clean previous builds
rm -f "dist-electron/Instagram DM Tool MINIMAL.exe"

# Build frontend first
echo "Building frontend..."
npm run build

# Build minimal Windows version
echo "Building minimal Windows executable..."
npx electron-builder --win --config package-minimal.json

# Rename the output
if [ -f "dist-electron/Instagram DM Tool 1.0.0.exe" ]; then
    mv "dist-electron/Instagram DM Tool 1.0.0.exe" "dist-electron/Instagram DM Tool MINIMAL.exe"
    echo "✅ Minimal build created: Instagram DM Tool MINIMAL.exe"
else
    echo "❌ Build failed - no output file found"
fi

# Cleanup
rm package-minimal.json

echo ""
echo "📦 Try downloading and running: Instagram DM Tool MINIMAL.exe"
echo "This version should at least show a window, even if features don't work yet."

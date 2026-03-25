#!/bin/bash

# Enhanced Windows Build Script for Instagram DM Tool
# Builds multiple Windows installer formats with professional features

echo "🪟 Enhanced Windows Build for Instagram DM Tool"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Must be run from project root directory"
    exit 1
fi

# Clean previous builds
print_step "Cleaning previous Windows builds..."
rm -rf dist-electron/win-*
rm -rf dist-electron/*Setup*.exe
rm -rf dist-electron/*.msi
rm -rf dist-electron/*portable*.exe

# Ensure dependencies are up to date
print_step "Installing dependencies..."
npm install

# Generate icons with ICO support
print_step "Generating Windows-optimized icons..."
npm run generate-icons

# Build frontend
print_step "Building frontend..."
npm run build

# Install and verify backend dependencies
print_step "Preparing backend..."
if [ -f "backend/package.json" ]; then
    (cd backend && npm install --production)
    if [ ! -d "backend/node_modules" ]; then
        print_error "Backend dependencies not installed properly"
        exit 1
    fi
    print_success "Backend dependencies verified"
fi

# Build Windows installers
print_step "Building Windows installers (NSIS, MSI, Portable)..."
print_warning "This may take several minutes..."

# Set Windows-specific environment variables
export WIN_CODE_SIGN=false  # Set to true if you have code signing certificates
export DEBUG_BUILD=false

# Build all Windows targets
npm run build-electron-win

# Check build results
print_step "Verifying build results..."

DIST_DIR="./dist-electron"
WIN_FILES=(
    "Instagram DM Tool Setup*.exe"
    "*.msi"
    "*portable*.exe"
    "win-unpacked/Instagram DM Tool.exe"
)

print_success "Windows build complete!"
echo ""
echo "📁 Generated files in $DIST_DIR:"

for pattern in "${WIN_FILES[@]}"; do
    files=$(ls $DIST_DIR/$pattern 2>/dev/null)
    if [ -n "$files" ]; then
        echo "$files" | while read file; do
            if [ -f "$file" ]; then
                size=$(du -h "$file" | cut -f1)
                echo "  📄 $(basename "$file") ($size)"
            fi
        done
    fi
done

echo ""
echo "🎉 Windows installers ready for distribution!"
echo ""
echo "📋 Installation types created:"
echo "  • NSIS Installer (.exe) - Standard Windows installer with wizard"
echo "  • MSI Package (.msi) - Enterprise-friendly MSI installer"  
echo "  • Portable Version (.exe) - No installation required"
echo ""
echo "🔒 Security Notes:"
echo "  • Code signing: Currently disabled (test certificates)"
echo "  • To enable code signing: Get certificates from a CA like DigiCert"
echo "  • SmartScreen: Unsigned apps may show warnings initially"
echo ""
echo "📤 Next Steps:"
echo "  1. Test installers on clean Windows systems"
echo "  2. Consider code signing for production release"
echo "  3. Create download page with installer options"
echo "  4. Set up auto-updater for seamless updates"

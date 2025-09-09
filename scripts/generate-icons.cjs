const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Icon sizes needed for different platforms
const iconSizes = {
  // Windows ICO sizes
  windows: [16, 24, 32, 48, 64, 128, 256],
  // macOS ICNS sizes
  mac: [16, 32, 64, 128, 256, 512, 1024],
  // Linux PNG sizes
  linux: [16, 24, 32, 48, 64, 128, 256, 512],
};

async function generateWindowsICO(svgBuffer, iconsDir) {
  try {
    // Generate ICO file for Windows
    const icoSizes = [16, 32, 48, 256];
    const icoBuffers = [];

    for (const size of icoSizes) {
      const buffer = await sharp(svgBuffer)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      icoBuffers.push(buffer);
    }

    // For now, save the 256x256 as icon.ico (most tools can convert multiple sizes)
    const iconBuffer = await sharp(svgBuffer)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(iconsDir, "icon.ico"), iconBuffer);
    console.log("Generated: icon.ico");
  } catch (error) {
    console.warn("ICO generation failed, using PNG fallback:", error.message);
    // Fallback to PNG
    const iconBuffer = await sharp(svgBuffer)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(iconsDir, "icon.ico"), iconBuffer);
    console.log("Generated: icon.ico (PNG format)");
  }
}

async function generateIcons() {
  const svgPath = path.join(__dirname, "../public/send-message-dm.svg");
  const iconsDir = path.join(__dirname, "../assets/icons");

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate all required sizes
    const allSizes = [
      ...new Set([...iconSizes.windows, ...iconSizes.mac, ...iconSizes.linux]),
    ];

    console.log("Generating icons from SVG...");

    for (const size of allSizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(svgBuffer)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outputPath);

      console.log(`Generated: icon-${size}x${size}.png`);
    }

    // Generate main icon (512x512)
    await sharp(svgBuffer)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(iconsDir, "icon.png"));
    console.log("Generated: icon.png (main icon)");

    // Generate high-DPI icon (1024x1024)
    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(iconsDir, "icon-large.png"));
    console.log("Generated: icon-large.png (high-DPI)");

    // Generate Windows ICO file
    await generateWindowsICO(svgBuffer, iconsDir);

    console.log("\n✅ All icons generated successfully!");
    console.log("Icons saved to:", iconsDir);
  } catch (error) {
    console.error("❌ Error generating icons:", error);
    process.exit(1);
  }
}

generateIcons();

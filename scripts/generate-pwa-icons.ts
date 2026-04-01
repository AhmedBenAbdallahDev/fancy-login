import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputIcon = path.join(process.cwd(), "public", "crystal.svg");
const outputDir = path.join(process.cwd(), "public", "pwa-icons");

async function generateIcons() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("Generating PWA icons...");

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(inputIcon).resize(size, size).png().toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate apple-touch-icon (180x180)
  await sharp(inputIcon)
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, "apple-touch-icon.png"));
  console.log("Generated: apple-touch-icon.png");

  // Generate favicon.ico (32x32)
  await sharp(inputIcon)
    .resize(32, 32)
    .png()
    .toFile(path.join(outputDir, "favicon-32x32.png"));
  console.log("Generated: favicon-32x32.png");

  // Generate 16x16 favicon
  await sharp(inputIcon)
    .resize(16, 16)
    .png()
    .toFile(path.join(outputDir, "favicon-16x16.png"));
  console.log("Generated: favicon-16x16.png");

  console.log("\nAll PWA icons generated successfully!");
}

generateIcons().catch(console.error);

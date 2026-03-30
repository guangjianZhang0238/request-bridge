# Build Resources

This directory contains resources needed for packaging the application.

## Required Files

### Windows
- `icon.ico` - Application icon (256x256 recommended)
  - Used for: executable, installer, shortcuts

### macOS
- `icon.icns` - Application icon
  - Used for: app bundle, DMG

### Linux
- `icons/` - Directory containing PNG icons in various sizes
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## How to Create Icons

1. Start with a high-resolution PNG (512x512 or 1024x1024)
2. Use online tools or software to convert:
   - **ICO**: Use ImageMagick or online converters
   - **ICNS**: Use `iconutil` on macOS or online converters
   - **PNG set**: Use ImageMagick to resize

### Example with ImageMagick
```bash
# Create ICO from PNG
convert icon-512.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Create ICNS from PNG
mkdir icon.iconset
convert icon-512.png -resize 16x16 icon.iconset/icon_16x16.png
convert icon-512.png -resize 32x32 icon.iconset/icon_16x16@2x.png
convert icon-512.png -resize 32x32 icon.iconset/icon_32x32.png
convert icon-512.png -resize 64x64 icon.iconset/icon_32x32@2x.png
convert icon-512.png -resize 128x128 icon.iconset/icon_128x128.png
convert icon-512.png -resize 256x256 icon.iconset/icon_128x128@2x.png
convert icon-512.png -resize 256x256 icon.iconset/icon_256x256.png
convert icon-512.png -resize 512x512 icon.iconset/icon_256x256@2x.png
convert icon-512.png -resize 512x512 icon.iconset/icon_512x512.png
convert icon-512.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
```

## Current Status

This directory is empty. You need to add icon files before building for production.

For development, the app will use default Electron icons.

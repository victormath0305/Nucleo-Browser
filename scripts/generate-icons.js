const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const iconSizes = [16, 32, 48, 64, 128, 256];
  const svgPath = path.join(__dirname, '..', 'src', 'assets', 'icons', 'nucleo-icon.svg');
  const outputDir = path.join(__dirname, '..', 'src', 'assets', 'icons');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const win = new BrowserWindow({
    width: 300,
    height: 300,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  const pngBuffers = {};

  for (const size of iconSizes) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
          svg { width: ${size}px; height: ${size}px; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;
    
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.setSize(size, size);
    
    // Give render pipeline a moment for SVG filters to settle
    await new Promise(r => setTimeout(r, 120));
    
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    const pngBuffer = image.toPNG();
    const filePath = path.join(outputDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, pngBuffer);
    pngBuffers[size] = pngBuffer;
    console.log(`Generated: icon-${size}.png (${size}x${size})`);
  }

  // Create icon.png (256x256 default)
  fs.writeFileSync(path.join(outputDir, 'icon.png'), pngBuffers[256]);
  console.log('Generated: icon.png');

  // Pack into a standard multi-resolution Windows .ico file (PNG-compressed)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(icoSizes.length, 4); // Number of images

  let offset = 6 + (icoSizes.length * 16);
  const directoryEntries = [];
  const imageDatas = [];

  for (const size of icoSizes) {
    const buf = pngBuffers[size];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // Width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buf.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    directoryEntries.push(entry);
    imageDatas.push(buf);
    offset += buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...directoryEntries, ...imageDatas]);
  const icoPath = path.join(outputDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Generated: icon.ico (${icoBuffer.length} bytes) with sizes [${icoSizes.join(', ')}]`);

  win.close();
  app.quit();
});

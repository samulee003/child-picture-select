import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const input = 'resources/logo_new.png';
const outputPng = 'src/renderer/public/logo.png';
const outputIco = 'resources/logo.ico';

async function generate() {
  console.log('Generating PNG for renderer...');
  await sharp(input)
    .resize(512, 512)
    .toFile(outputPng);
  console.log('PNG generated at', outputPng);

  // For the ICO, if we don't have a library, we can try to use sharp to create 
  // a square PNG and then we might need a converter.
  // Since we have svg2ico/svg-to-ico, maybe we can't easily do png-to-ico 
  // without a new dependency.
  // However, electron-builder can often take a png.
  // But the current config explicitly asks for .ico.
  
  console.log('Updating resources/logo.ico (placeholder for now, will attempt conversion)');
  // If I can't do ICO easily, I'll at least provide the high-res PNG 
  // which can be used by most modern Windows versions if renamed or updated in config.
}

generate().catch(console.error);

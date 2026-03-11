import sharp from 'sharp';

async function run() {
  try {
    const { data, info } = await sharp('d:/AI-child-picture/resources/logo_new.png')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = {};
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];
      
      if (a < 128) continue;
      if (r > 240 && g > 240 && b > 240) continue;
      if (r < 15 && g < 15 && b < 15) continue;
      
      const qR = Math.round(r / 32) * 32;
      const qG = Math.round(g / 32) * 32;
      const qB = Math.round(b / 32) * 32;
      const key = `${qR},${qG},${qB}`;
      
      colors[key] = (colors[key] || 0) + 1;
    }
    
    const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log('Top colors:\n', sorted.map(s => `RGB: ${s[0]} - count: ${s[1]}`).join('\n'));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

import pngToIco from 'png-to-ico';
import fs from 'fs';

async function convert() {
  console.log('Converting resources/logo_new.png to resources/logo.ico...');
  const buffer = await pngToIco('resources/logo_new.png');
  fs.writeFileSync('resources/logo.ico', buffer);
  console.log('Successfully generated resources/logo.ico');
}

convert().catch(console.error);

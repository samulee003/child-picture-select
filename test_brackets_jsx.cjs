const fs = require('fs');

const content = fs.readFileSync('src/renderer/components/SwipeReview.tsx', 'utf8');
let openCount = 0;

for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') openCount++;
  if (content[i] === '}') openCount--;
}

console.log('Braces diff:', openCount);

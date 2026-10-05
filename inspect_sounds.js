import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'Sounds memes');
const files = fs.readdirSync(dir);
console.log('Found ' + files.length + ' files:');

files.forEach(f => {
  const fullPath = path.join(dir, f);
  const stats = fs.statSync(fullPath);
  console.log(JSON.stringify({ file: f, size: stats.size }));
});

import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';

const dir = path.join(process.cwd(), 'Sounds memes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));

async function inspectAll() {
  for (const f of files) {
    const fullPath = path.join(dir, f);
    try {
      const meta = await mm.parseFile(fullPath);
      console.log('--- ' + f + ' ---');
      console.log('Duration:', meta.format.duration);
      console.log('Title:', meta.common.title);
      console.log('Artist:', meta.common.artist);
      console.log('Album:', meta.common.album);
      console.log('Comment:', meta.common.comment);
    } catch (e) {
      console.error('Error parsing', f, e.message);
    }
  }
}

inspectAll();

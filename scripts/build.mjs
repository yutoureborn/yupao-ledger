import { cp, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'public'), dist, { recursive: true });
await copyFile(path.join(root, 'build/frontend/app.js'), path.join(dist, 'app.js'));
await copyFile(path.join(root, 'build/frontend/app.js.map'), path.join(dist, 'app.js.map'));
console.log('Build complete:', dist);

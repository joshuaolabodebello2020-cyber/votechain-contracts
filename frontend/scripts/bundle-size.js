import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('dist/assets directory not found; run npm run build first.');
  process.exit(1);
}

const bundleFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'));

if (bundleFiles.length === 0) {
  console.error('No JavaScript bundle files found in dist/assets.');
  process.exit(1);
}

for (const file of bundleFiles) {
  const filePath = path.join(assetsDir, file);
  const { size } = fs.statSync(filePath);
  console.log(`${file}: ${(size / 1024).toFixed(2)} KB`);
}

const totalSize = bundleFiles.reduce((sum, file) => {
  const { size } = fs.statSync(path.join(assetsDir, file));
  return sum + size;
}, 0);

console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);

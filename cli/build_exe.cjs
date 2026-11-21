const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('1. Bundling cli/packager.js into cli/bundle.js with esbuild...');
execSync('npx --yes esbuild cli/packager.js --bundle --platform=node --target=node18 --outfile=cli/bundle.js', { stdio: 'inherit' });

console.log('\n2. Compiling single-executable preparation blob (SEA)...');
execSync('node --experimental-sea-config cli/sea-config.json', { stdio: 'inherit' });

console.log('\n3. Copying Node runtime binary to OrbitPackager.exe...');
const exePath = path.join(__dirname, '..', 'OrbitPackager.exe');
fs.copyFileSync(process.execPath, exePath);

console.log('\n4. Injecting SEA blob with postject...');
execSync(`npx --yes postject "${exePath}" NODE_SEA_BLOB cli/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });

console.log(`\n✓ Successfully created standalone executable: ${exePath}`);

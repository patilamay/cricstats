// GitHub Pages has no SPA routing, so serve the app for unknown paths too:
// copying index.html to 404.html lets deep links like /player/abc123 load.
import fs from 'node:fs';

fs.copyFileSync('dist/index.html', 'dist/404.html');
fs.writeFileSync('dist/.nojekyll', '');
console.log('wrote dist/404.html');

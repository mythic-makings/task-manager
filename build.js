const fs = require('fs');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
if (!url || !key) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  process.exit(1);
}
fs.writeFileSync('config.js', `window.SUPABASE_URL="${url}";\nwindow.SUPABASE_ANON_KEY="${key}";\n`);
console.log('config.js generated');

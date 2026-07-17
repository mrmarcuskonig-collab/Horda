import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const home = await (await fetch(b+'/')).text();
console.log('GUEST mode (HORDA_DEMO=0)');
console.log('  "Claim your @handle":', home.includes('Claim your @handle'));
console.log('  profile→/signup:', home.includes('href="/signup"'));
console.log('  no "Your feed →":', !home.includes('Your feed →'));
console.log('  Your Horda:', home.includes('Your Horda'));
process.exit(0);

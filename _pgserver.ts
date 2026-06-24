import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = new PGlite(); await db.waitReady;
const s = new PGLiteSocketServer({ db, port: 5547, host: '127.0.0.1' }); await s.start();
console.log('READY');

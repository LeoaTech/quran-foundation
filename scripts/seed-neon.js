/**
 * seed-neon.js — Run seeds against the Neon production database from a local machine.
 *
 * Usage:
 *   DATABASE_URL='postgresql://user:pass@host/db?sslmode=require' node scripts/seed-neon.js
 
 */

'use strict';

const dns  = require('dns');
const path = require('path');
const url  = require('url');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set.');
  console.error('    Run: DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/seed-neon.js');
  process.exit(1);
}

// Parse the connection string to extract the hostname
const parsed   = new url.URL(DATABASE_URL);
const hostname = parsed.hostname;

console.log(`🔍  Resolving ${hostname} to IPv4...`);

// Resolve to IPv4 FIRST, then build a replaced connection string
dns.resolve4(hostname, (err, addresses) => {
  if (err || !addresses || addresses.length === 0) {
    console.error('❌  DNS resolution failed:', err ? err.message : 'no addresses');
    process.exit(1);
  }

  const ipv4 = addresses[0];
  console.log(`✅  Resolved to ${ipv4}`);

  // Replace hostname with IPv4 in the connection string
  // pg needs the original hostname for SNI, so pass it via ssl.servername
  const knex = require(path.join(root, 'node_modules/knex'));

  const db = knex({
    client: 'postgresql',
    connection: {
      host: ipv4,
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.replace(/^\//, ''),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl: {
        rejectUnauthorized: false,
        servername: hostname,   // SNI: tells Neon which endpoint to route to
      },
      connectionTimeoutMillis: 15000,
    },
    seeds: {
      directory: path.join(root, 'src/db/seeds'),
    },
    pool: { min: 0, max: 2 },
  });

  console.log('\n🌱  Running seeds against Neon DB...\n');

  db.seed.run()
    .then(([files]) => {
      console.log('\n✅  Seeds completed successfully!');
      files.forEach(f => console.log('    ✓', path.basename(f)));
      return db.destroy();
    })
    .catch(err => {
      console.error('\n❌  Seed failed:', err.message);
      if (err.errors) err.errors.forEach(e => console.error('   ', e.message));
      db.destroy().then(() => process.exit(1));
    });
});

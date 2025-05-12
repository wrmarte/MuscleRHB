const { Client } = require('pg');

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

db.connect();

db.query(`
  CREATE TABLE IF NOT EXISTS wallet_links (
    user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL
  )
`);

async function linkWallet(userId, walletAddress) {
  await db.query(
    `INSERT INTO wallet_links (user_id, wallet_address)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address`,
    [userId, walletAddress]
  );
}

async function getWallet(userId) {
  const res = await db.query(
    `SELECT wallet_address FROM wallet_links WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0]?.wallet_address || null;
}

module.exports = { linkWallet, getWallet };

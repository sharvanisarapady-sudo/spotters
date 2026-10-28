require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/db');

async function main() {
  try {
    const [cases] = await pool.query(
      "SELECT id, title FROM practice_cases WHERE title LIKE 'Mock MRI:%'"
    );

    const [tests] = await pool.query(
      'SELECT id, block_number, title FROM tests WHERE block_number = 99'
    );

    console.log('Existing Mock MRI cases:', cases);
    console.log('Existing block 99 tests:', tests);
  } catch (error) {
    console.error('Database check failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/db');

async function main() {
  try {
    const [cases] = await pool.query(
      "SELECT id, title FROM practice_cases WHERE title LIKE 'Mock MRI:%'"
    );

    const [tests] = await pool.query(
      "SELECT id, block_number, title, total_questions FROM tests WHERE block_number = 99"
    );

    const [images] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM case_images ci
       JOIN practice_cases pc ON pc.id = ci.case_id
       WHERE pc.title LIKE 'Mock MRI:%'`
    );

    console.log('Mock MRI cases:', cases);
    console.log('Mock MRI quiz:', tests);
    console.log('Total mock MRI images:', images[0].total);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

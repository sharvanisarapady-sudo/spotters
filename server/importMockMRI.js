require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spotters_db',
    multipleStatements: true,
  });

  try {
    const sqlPath = 'C:\\Users\\sharv\\Downloads\\spotters-ai-layer-main (1)\\spotters-ai-layer-main\\spotters-merge\\mock-mri\\mock_mri.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await connection.beginTransaction();
    await connection.query(sql);
    await connection.commit();

    console.log('Mock MRI SQL imported successfully.');
  } catch (error) {
    await connection.rollback();
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

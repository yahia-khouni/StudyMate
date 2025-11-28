require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
};

async function runMigrations() {
  const isFresh = process.argv.includes('--fresh');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'studyai',
    password: process.env.DB_PASSWORD || 'studyai_password',
    database: process.env.DB_NAME || 'studyai',
    multipleStatements: true,
  });

  try {
    logger.info('Connected to database');

    if (isFresh) {
      logger.info('Running fresh migration - dropping all tables...');
      
      // Disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Get all tables
      const [tables] = await connection.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
        [process.env.DB_NAME || 'studyai']
      );
      
      // Drop all tables
      for (const { table_name } of tables) {
        await connection.query(`DROP TABLE IF EXISTS \`${table_name}\``);
        logger.info(`Dropped table: ${table_name}`);
      }
      
      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // Create migrations tracking table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get already executed migrations
    const [executedMigrations] = await connection.query(
      'SELECT name FROM _migrations ORDER BY id'
    );
    const executedNames = new Set(executedMigrations.map((m) => m.name));

    // Read migration files
    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of migrationFiles) {
      if (executedNames.has(file) && !isFresh) {
        logger.info(`Skipping already executed: ${file}`);
        continue;
      }

      logger.info(`Running migration: ${file}`);
      
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
        logger.success(`Completed: ${file}`);
      } catch (err) {
        logger.error(`Failed to run ${file}: ${err.message}`);
        throw err;
      }
    }

    logger.success('All migrations completed successfully!');
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();

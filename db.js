// SQLite Set-Up

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    } else {
        console.log('Database connected');
        db.run("PRAGMA foreign_keys=ON");
    }
});

module.exports = db;

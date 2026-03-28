// SQLite Set-Up

const sqlite3 = require('sqlite3').verbose();
const config = require('../config/config');

const db = new sqlite3.Database(config.database.path, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    } else {
        console.log('Database connected');
        db.run("PRAGMA foreign_keys=ON");
    }
});

module.exports = db;

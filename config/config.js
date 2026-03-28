const { cookie } = require('express-validator');

require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    database: { path: process.env.DATABASE_PATH || './db/blog.db' },
    session: {
        secret: process.env.SESSION_SECRET,
        cookie: {
            httpOnly: true, // Prevents js from stealing session
            resave: false, // only save if session changed
            saveUninitialized: false, // only save session with data
            cookie : { maxAge: 24 * 60 * 60 * 1000 } // 24 hours session age
        }
    }
};
/**
* index.js
* This is main app entry point
*/

// Set up express, bodyparser, EJS, helmet, flash etc
const express = require('express');
const session = require('express-session');
const bodyParser = require("body-parser");
const helmet = require('helmet');
const flash = require('connect-flash');
const config = require('./config/config');

// Create an Express application instance
const app = express();

// Define the port number the server will listen on
const port = config.port;

// Middleware to parse URL-encoded request bodies (like form submissions)
// 'extended: true' allows for rich obje2cts and nested arrays to be encoded
app.use(bodyParser.urlencoded({ extended: true }));

// set the app to use ejs for rendering
app.set('view engine', 'ejs');

// set location of static files
app.use(express.static(__dirname + '/public'));

// Database connection
const db = require('./db/database');

// Session setup
app.use(session(config.session));

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false  // Disable CSP
}));

// Flash Messages
app.use(flash());

// Route for the main homepage
app.get('/', (req, res) => {
    res.render('homepage', {messages: req.flash()});

});

// Import and mount all blog-related routes under /blog
const blogRoutes = require('./routes/blog');
app.use('/blog', blogRoutes);

// Make the web application listen for HTTP requests
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
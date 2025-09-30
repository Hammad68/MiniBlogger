/**
* index.js
* This is main app entry point
*/

// Set up express, bodyparser and EJS
const express = require('express');
const session = require('express-session');
const app = express();
const port = 3000;
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set the app to use ejs for rendering
app.use(express.static(__dirname + '/public')); // set location of static files

// Database connection
const db = require('./db');

// Session setup
app.use(session ({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    // Optional
    cookie: {maxAge: 24 * 60 *60 * 60 * 1000} 
}));

// Route for the main homepage
app.get('/', (req, res) => {
    res.render('homepage');
});

// Import and mount all blog-related routes under /blog
const blogRoutes = require('./routes/blog');
app.use('/blog', blogRoutes);

// Make the web application listen for HTTP requests
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
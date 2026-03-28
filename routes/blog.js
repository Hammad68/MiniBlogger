 // ---------------------------- IMPORT SECTION ----------------------------  


const { query } = require("express");
const express = require("express");
const router = express.Router();
const db = require('../db/database');
const bcrypt = require('bcrypt');
const { body, validationResult, Result } = require('express-validator');
const dayjs = require("dayjs");
const relativeTime = require('dayjs/plugin/relativeTime');
const { name } = require("ejs");
dayjs.extend(relativeTime);
const { requireAuthentication, requireAuthor } = require('../middleware/authentication');


// ---------------------------- HELPER FUNCTION FOR FETCHING DATA ----------------------------  


// Wrap db.all in a promise to use async/await
function dbAllAsync(query, params = []){
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if(err) return reject(err);
            resolve(rows);
        });
    });
}

// Wrap db.get in a promise to use async/await
function dbGetAsync(query, params = []){
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if(err) return reject(err);
            resolve(row);
        });
    });
}

// Wrap db.run in a promise to use async/await
function dbRunAsync(query, params = []){
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err){
            if(err) return reject(err);
            resolve();
        });
    });
}

// Helper function for fetching data from three SQL tables of the database - blog, publishBlog, and names 
async function fetchData(userId, callback) {

    try {
        const drafted = await dbAllAsync(`SELECT b.* FROM blog AS b JOIN users AS u on b.author_id = u.id WHERE b.blog_status = 'DRAFT' AND b.author_id = ? ORDER BY b.created_at DESC`, [userId]);
        const published = await dbAllAsync(`SELECT b.* FROM blog AS b JOIN users AS u on b.author_id = u.id WHERE b.blog_status = 'PUBLISHED' AND b.author_id = ? ORDER BY b.created_at DESC`, [userId]);
        const names = await dbAllAsync(`SELECT u.name, u.about FROM users u WHERE u.id = ?`, [userId]);

        // Formatting dates for drafted blogs
        drafted.forEach(blog => {
            if(blog.created_at) blog.createdAgo = dayjs(blog.created_at).fromNow();
            if(blog.modified_at) blog.modifiedAgo = dayjs(blog.modified_at).fromNow();
        });

        // Formatting dates for published blogs
        published.forEach(blog => {
            if(blog.created_at) blog.createdAgo = dayjs(blog.created_at).format('MMM D, YYYY') ;
            if(blog.modified_at) blog.modifiedAgo = dayjs(blog.modified_at).fromNow();
            if(blog.published_at) blog.publishedAgo = dayjs(blog.published_at).format('MMM D, YYYY') ;

        });

        // If no errors, pass null for the error, and then get results
        callback(null, drafted, published, names);

    } catch (err) {
        console.error(err);
        callback(err, null, null, null);
    }
}
 
// To fetch published blogs information for displaying them based on the descending order of their published timestamp information
const fetchPublishedblogs = (req, res, next) => {
    const query = `SELECT * FROM blog WHERE blog.blog_status = 'PUBLISHED' ORDER BY published_at DESC`;
    db.all(query, [], (err, blogs) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        blogs.forEach(blog => {
            blog.formattedDate = dayjs(blog.published_at).fromNow();
        });

        // Attach the fetched blogs to the request object
        req.publishedblogs = blogs;
        next(); // Continue to the next middleware or route handler
    });
};

// To fetch comments based on the publish_id of the blog which the user is reading currently
const fetchComments = (req, res, next) => {
    const blogId = req.params.blog_id;
    const queryComments = 'SELECT * FROM comments WHERE blog_id = ? ORDER BY commented_at DESC';
    db.all(queryComments, [blogId], (err, comments) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        comments.forEach(comment => {
            comment.formattedDate = dayjs(comment.commented_at).format('MMM D, YYYY');
        });

        // Attach the fetched comments to the request object
        req.comments = comments;
        next(); // Continue to the next middleware or route handler
    });
}; 

// To fetch author names (only needed for the reader-homepage)
const fetchReaderNames = (req, res, next) => {
    const userId = req.session.userId;

    const namesQuery = `SELECT name FROM users WHERE role = 'READER' AND id = ?`;
    db.all(namesQuery, userId, (err, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        // Attach the fetched names to the request object
        req.readerName  = names;
        next(); // Continue to the next middleware or route handler
    });
};

// ---------------------------- SENDING FETCHED OR DATA WHICH IS BEING FETCHED TO THE WEBPAGES ----------------------------

///////////////////////////////////////////////////// LOGIN SECTION //////////////////////////////////////////////////////
router.post("/login", async(req, res) => {

    const {username, password} = req.body;

    try {
        const user = await dbGetAsync('SELECT id, name, email, password, role FROM users WHERE email = ? AND is_active = 1', [username]);

        if (!user)
        {
            req.flash("error", "Invalid username or password");
            console.log("User not found");
            return res.redirect("/");
        }

        const isMatched = await bcrypt.compare(password, user.password);

        if(!isMatched)
        {
            req.flash("error", "Invalid uername or password");
            console.log('Wrong Password');
            return res.redirect("/");
        }

        // Set the session before redirecting
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.name = user.name;
        req.session.username = user.email;

        if (user.role === "AUTHOR") {
            return res.redirect('/blog/author-homepage');
        } else if (user.role === "READER") {
            return res.redirect('/blog/reader-homepage');
        } else {
            console.log("User role is not defined");
            req.flash("error", "user role is not defined");
            return res.status(403).send("Access Denied");
        }
        
    } 
    catch {
        req.flash("error", "Login failed please try again later");
        console.log('Login Error: ', err.message);
        return res.redirect('/');
    }

});

router.post("/register", async (req, res) => {

    const {fullname, email, role, password, securityAnswer} = req.body;

    try{

        const userExists = await dbGetAsync('SELECT id FROM users WHERE email = ?', [email]);

        if(userExists){
            req.flash("error", "User already exists");
            console.log("user already exists")
            return res.redirect('/');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const hashedabout = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

        await dbRunAsync("INSERT INTO users(name, email, role, password, security_answer) VALUES (?, ?, ?, ?, ?)", [fullname, email, role.toUpperCase(), hashedPassword, hashedabout]);

        req.flash("success", "Registration was successful");
        // console.log("registration was successful", result.lastID);
        res.redirect("/");
    }
    catch (err) {
        req.flash("error", "Registration failed, please try again later");
        console.log("registration unsuccessful", err.message);
        res.redirect('/');
    }
});

router.post("/forgot-password", async(req, res) => {
    const {email, newPassword, securityAnswer} = req.body;
     
    try{
        const user = await dbGetAsync('SELECT id, security_answer FROM users WHERE email = ?', [email]);
        if (!user) {
            req.flash("error", "Invalid email or security answer");
            return res.redirect('/');
        }

        const isMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer);
        if (!isMatch) {
            req.flash("error", "Invalid email or security answer");
            return res.redirect('/');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updateHashPassword = await dbRunAsync('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        req.flash("success", "Password reset successful! Please Login");
        res.redirect("/"); 
    }
    catch(err){
        req.flash("error", "Failed to reset password. Please Try Again.");
        res.redirect("/");
    }
});


router.get("/search-blog", fetchReaderNames, fetchPublishedblogs, requireAuthentication, async(req, res) => {
    const searchBox = req.query.searchBox;
    // const names = req.session.name;
    const names = req.readerName;
    const blogs = req.publishedblogs;


    if(!searchBox || searchBox.trim() === ""){
        return res.redirect("/reader-homepage");
    }else {
        const blog = await dbAllAsync("SELECT * FROM blog WHERE (blog_title LIKE ? OR blog_content LIKE ?) AND blog_status = 'published' ORDER BY created_at DESC", ['%${searchBox}%', '%${searchBox}%']);
        res.render('reader-homepage', {names, blogs, searchResults: blog});
    }
});

///////////////////////////////////////////////////// AUTHOR SECTION //////////////////////////////////////////////////////

// Route for Settings page to get fetched data of drafted - (blogs), published - (blogs), and names - (author name & blog title)
router.get("/settings", requireAuthor, (req, res) => {
    // Fetching updated data and render the Author Homepage
    fetchData(req.session.userId, (err, drafted, published, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('settings', { drafted, published, names });
    });

});

// Route for Creating Draft (blogs) when pressed the create draft button it redirects the 
router.get("/create-draft", requireAuthor, (req, res) => {
    res.render("create-draft");
});

//  Route for redirecting the user back to the author homepage
router.get("/back-to-author-homepage", (req, res) => {
    res.redirect("author-homepage");
});

// Route for Author-Homepage to get fetched data of drafted - (blogs), published - (blogs) and names - (author name & blog title)
router.get('/author-homepage', requireAuthor, (req, res) => {
    // Fetching updated data and render the Author Homepage
    fetchData(req.session.userId, (err, drafted, published, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        console.log(names);
        res.render('author-homepage', { drafted, published, names});
    });
});

// Logout route
router.post('/logout', requireAuthentication, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});


///////////////////////////////////////////////////// READER SECTION //////////////////////////////////////////////////////

// For redirecting the user back to the reader-homepage
router.get("/back-to-reader-homepage", (req, res) => {
    if(req.session.role === "AUTHOR"){
        res.redirect('/blog/author-homepage');
    }
    else if (req.session.role === "READER"){
        res.redirect('reader-homepage');
    }
});

// For redirecting the user back to the main homepage
router.get("/back-to-homepage", (req, res) => {
    res.redirect('/');   
});

// Reader's homepage route to fetch the relevant data using the above mentioned helper functions
router.get("/reader-homepage", fetchPublishedblogs, fetchReaderNames, (req, res) => {
    // Access fetched data from req object
    const blogs = req.publishedblogs;
    const names = req.readerName;

    console.log(names);

    // Render the reader homepage with the fetched data
    res.render('reader-homepage', { blogs, names });
});

// Display blog details and increment view count when clicked on the reader-homepage blog list.
router.get("/reader-blog/:blog_id", fetchComments, (req, res) => {
    const blogId = req.params.blog_id;

    // Fetch the specific blog with author info
    const query = `
        SELECT b.*, u.name as author_name, u.about as author_about
        FROM blog b
        JOIN users u ON b.author_id = u.id
        WHERE b.blog_id = ? AND b.blog_status = 'PUBLISHED'
    `;
    db.get(query, [blogId], (err, blog) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        if (!blog) {
            return res.status(404).send('Blog not found');
        }

        // Formatting the date of publication
        if(blog.published_at) blog.publishedAgo = dayjs(blog.published_at).format('MMM D, YYYY') ;

        // Initialize viewedBlogs if not exists
        if (!req.session.viewedBlogs) req.session.viewedBlogs = [];

        // Increment blog_reads only if not already viewed in this session
        if (!req.session.viewedBlogs.includes(blogId)) {
            req.session.viewedBlogs.push(blogId);

            // Increment blog_reads
            const readsQuery = `UPDATE blog SET blog_reads = blog_reads + 1 WHERE blog_id = ?`;
            db.run(readsQuery, [blogId], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                // Render the reader blog page with the fetched blog and comments
                res.render('reader-article-page', { blog, comments: req.comments });
            });
        } else {
                // If already viewed, just render without incrementing
                res.render('reader-article-page', { blog, comments: req.comments });
        }
    });
});

// Route to get the blog content such as it's title and content on the Edit blog page based on the id of the blog which user wants to edit
router.get('/edit-blog/:id', requireAuthor, (req, res) => {
    const blogId = req.params.id;
    const authorId = req.session.userId;

    // query to edit the blog with the given ID
    const query = 'SELECT * FROM blog WHERE blog_id = ? AND author_id = ?';
    db.get(query, [blogId, authorId], (err, blog) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // ✅ DEBUG LOGGING
        console.log('=== EDIT BLOG DEBUG ===');
        console.log('Blog ID:', blog.blog_id);
        console.log('Title:', blog.blog_title);
        console.log('Content exists:', !!blog.blog_content);
        console.log('Content length:', blog.blog_content ? blog.blog_content.length : 0);
        console.log('Content preview:', blog.blog_content ? blog.blog_content.substring(0, 150) + '...' : 'EMPTY');

        // Formatting the date of creation & modification
        if(blog.created_at) blog.createdAgo = dayjs(blog.created_at).format('MMM D, YYYY');
        if(blog.modified_at) blog.modifiedAgo = dayjs(blog.modified_at).fromNow();

        res.render('edit-article', { blog }); // Pass the blog object to the template

    });
});


///////////////////////////// ROUTES FOR TAKING ACTION BASED ON THE USER INTERACTION /////////////////////////////        


///////////////////////////////////////////////////// AUTHOR SECTION //////////////////////////////////////////////////////

// Route for to post content of the draft blog e.g. title, content and status of the blog into blog SQL table from the Create Draft page's input fields
router.post('/submit-blog', requireAuthor, [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('blogTitle').trim().escape(),
    body('blogBody').trim()
], (req, res) => {
    const blogTitle = req.body.blogTitle;
    const blogBody = req.body.blogBody;

    // Set the default value for blog_status as 'draft' and insert the blog title, content from the input field
    const query = 'INSERT INTO blog (blog_title, blog_content, blog_status, author_id) VALUES (?, ?, ?, ?)';
    const blogStatus = 'DRAFT';
    db.run(query, [blogTitle, blogBody, blogStatus, req.session.userId], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        res.redirect('/blog/author-homepage');
    });
});

// Route to delete to delete blogs from blog SQL table which are being displayed in draft blog section of the Author Homepage
router.post('/delete-blog',  requireAuthor, (req, res) => {
    const blogId = req.body.blog_id;
    const authorId = req.session.userId;

    // query for deleting blog from the blog table
    const query = 'DELETE FROM blog WHERE blog_id = ? AND author_id = ?';
    db.run(query, [blogId, authorId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        res.redirect('/blog/author-homepage');
    });
});

// Route to update blog title and content based on the user input in the input feilds of the Edit blog page
router.post('/update-blog/:id',  requireAuthor, [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('title').trim().escape(),
    body('content').trim()
], (req, res) => {
    const blogId = req.params.id;
    const updatedTitle = req.body.title;
    const updatedContent = req.body.content;

    // query to update and add blog details in the blog table
    const query = 'UPDATE blog SET blog_title = ?, blog_content = ?, modified_at = CURRENT_TIMESTAMP WHERE blog_id = ? AND author_id = ?';
    db.run(query, [updatedTitle, updatedContent, blogId, req.session.userId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        res.redirect('/blog/author-homepage');
    });
});

// Route to move an blog from 'blog' (drafts) to 'publishBlog' (published), updating its status by fetching the draft blogs, inserting it into 'publishBlog', and removing from 'blog'.
router.post('/publish-blog', requireAuthor, (req, res) => {
    const blogId = req.body.blog_id;

    // Retrieve the blog to be published
    const selectQuery = `Update blog SET blog_status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP WHERE blog_id = ? AND author_id = ?`;
    db.run(selectQuery, [blogId, req.session.userId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        
        // If blog retrieved without error
        if (this.changes === 0) {
            // Handle the case where the blog is not found
            res.status(404).send('blog not found');
        } 
        
        return res.redirect('/blog/author-homepage');
    });
});

// Route to Author Blog Settings page to change the previuosly set or add new author name and blog title to the names SQL table and display it on the Author Homepage.
router.post('/author-blog-setting', requireAuthor, [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('author_name').trim().escape(),
    body('author_about').trim().escape()
], (req, res) => {

    // Retrieve author_name and blog_title from request body
    const { author_name, author_about } = req.body;

    // Update user's name and about in users table
    const updateQuery = 'UPDATE users SET name = ?, about = ? WHERE id = ?';
    
    db.run(updateQuery, [author_name, author_about, req.session.userId], function(err) {
        if (err) {
            console.error('Error updating profile:', err.message);
            req.flash('error', 'Error updating profile');
            return res.status(500).send('Internal Server Error');
        }

        console.log('Rows updated:', this.changes);

        if (this.changes === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/blog/settings');
        }

        // Update session with new name
        req.session.name = author_name;

        req.flash('success', 'Profile updated successfully!');
        res.redirect('/blog/author-homepage');
    });
});

// Route to delete published blogs from the publishBlog SQL table and stop them being displayed on the published blogs section
router.post('/delete-publishedblog', requireAuthor, (req, res) => {
    const blogId = req.body.blog_id;

    // query to delete related comments first
    const deleteQuery = `DELETE FROM blog WHERE blog_id = ? AND author_id = ? AND blog_status = 'PUBLISHED'`;
    db.run(deleteQuery, [blogId, req.session.userId], (err) => {
        if (err) { 
            console.error(err.message);
            // db.run("ROLLBACK"); 
            return res.status(500).send('Internal Server Error'); 
        }
        res.redirect('/blog/author-homepage');
    });

});


///////////////////////////////////////////////////// READER SECTION //////////////////////////////////////////////////////

// Adding comments like in other to diplay them using sql to update comments like counts and the redirecting the user
router.post('/comment-like/:id', (req, res) => {
    const blogId = req.body.publish_id;
    const commentId = req.params.id;

    // Converting the comment id into for storing into liked comments array
    const commentid = req.params.id;

    // Checking if likedcomments array exists, if not then initializing an empty array
    if(!req.session.likedcomments) req.session.likedcomments = [];

    // If likedcomments array includes the comment id, if yes then redirect to the current page and do nothing
    if(req.session.likedcomments.includes(commentid)) return res.redirect(`/blog/reader-blog/${blogId}`);
    // Else add the comment id to the array of liked comments
    req.session.likedcomments.push(commentid);

    // Udpating the likes count
    const query = `UPDATE comments SET comment_likes = comment_likes + 1 WHERE comment_id = ?`;
    db.run(query, [commentId], (err) => {
        if (err) {
            res.status(500).send('Error updating comment likes');
            return;
        }

        req.session.save((err) => {
            if(err){
                res.status(500).send("Session save error - comment-like: ", err);
            }
            // Redirect back to the same blog page after adding a comment
            res.redirect(`/blog/reader-blog/${blogId}`);
        });
    });
});

// Adding comment to display them using sql to insert comments data from the input fields and store them in the database and reteriving the data to display
router.post('/add-comment', [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('name').trim().escape(),
    body('comment').trim().escape(),
], (req, res) => {
    const name = req.body.name;
    const content = req.body.comment;
    const blogId = req.body.publish_id;

    console.log('blog id for comment: ', blogId);

    const userId = req.session.userId;
    const nameUser = req.session.name;

     // ✅ Prevent duplicate comments in same session
    if (!req.session.commentedBlogs) {
        req.session.commentedBlogs = [];
    }

    // Check if already commented on this blog in this session
    if (req.session.commentedBlogs.includes(blogId)) {
        req.flash('error', 'You already commented on this blog in this session');
        return res.redirect(`/blog/reader-blog/${blogId}`);
    }

    // Add to commented blogs list
    req.session.commentedBlogs.push(blogId);

    // Inserting the comments data into the comments table
    const query = 'INSERT INTO comments (commentator_name, comment, blog_id) VALUES (?, ?, ?)';
    db.run(query, [nameUser, content, blogId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        req.session.save((err) => {
            if(err){
                res.status(500).send("Session save error - comment-like: ", err);
            }
            // Redirect back to the same blog page after adding a comment
            res.redirect(`/blog/reader-blog/${blogId}`);
        });
    });
});

/* Adding Likes using sql to update likes count based on the publish_id params of the comment and then redirecting the user back to the same blog page */
router.post('/like-blog/:id', (req, res) => {
    const blogId = req.params.id;

    console.log(req.params.id);

    if (!req.session.likedBlogs) req.session.likedBlogs = [];
    if (req.session.likedBlogs.includes(blogId)) return res.redirect(`/blog/reader-blog/${blogId}`);

    req.session.likedBlogs.push(blogId);

    // Updating the likes count in the comments table based on the publish id parameter
    const query = 'UPDATE blog SET blog_likes = blog_likes + 1 WHERE blog_id = ?';
    db.run(query, [blogId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        req.session.save((err) => {
            if(err){
                res.status(500).send("Session save error - comment-like: ", err);
            }
            // Redirect back to the same blog page after adding a comment
            res.redirect(`/blog/reader-blog/${blogId}`);
        });

    });
});

// Export the router object so index.js can access it
module.exports = router;

// ---------------------------- IMPORT SECTION ----------------------------  


const { query } = require("express");
const express = require("express");
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const dayjs = require("dayjs");
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);


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
// Helper function for fetching data from three SQL tables of the database - blog, publishBlog, and names 
async function fetchData(callback) {

    try {
        const drafted = await dbAllAsync('SELECT * FROM blog');
        const published = await dbAllAsync('SELECT * FROM publishBlog');
        const names = await dbAllAsync('SELECT * FROM names');

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
    const query = 'SELECT publish_id, blog_title, published_at FROM publishBlog ORDER BY published_at DESC';
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
    const publishId = req.params.publish_id;
    const queryComments = 'SELECT * FROM comments WHERE publish_id = ? ORDER BY commented_at DESC';
    db.all(queryComments, [publishId], (err, comments) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        comments.forEach(comment => {
            comment.formattedDate = dayjs(comment.published_at).format('MMM D, YYYY');
        });

        // Attach the fetched comments to the request object
        req.comments = comments;
        next(); // Continue to the next middleware or route handler
    });
};

// To fetch author names (only needed for the reader-homepage)
const fetchAuthorNames = (req, res, next) => {
    const namesQuery = 'SELECT * FROM names';
    db.all(namesQuery, [], (err, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        // Attach the fetched names to the request object
        req.authorNames = names;
        next(); // Continue to the next middleware or route handler
    });
};


// ---------------------------- SENDING FETCHED OR DATA WHICH IS BEING FETCHED TO THE WEBPAGES ----------------------------


///////////////////////////////////////////////////// AUTHOR SECTION //////////////////////////////////////////////////////

// Route for Settings page to get fetched data of drafted - (blogs), published - (blogs), and names - (author name & blog title)
router.get("/settings", (req, res) => {
    // Fetching updated data and render the Author Homepage
    fetchData((err, drafted, published, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('settings', { drafted, published, names });
    });

});

// Route for Creating Draft (blogs) when pressed the create draft button it redirects the 
router.get("/create-draft", (req, res) => {
    res.render("create-draft");
});

//  Route for redirecting the user back to the author homepage
router.get("/back-to-author-homepage", (req, res) => {
    res.redirect("author-homepage");
});

// Route for Author-Homepage to get fetched data of drafted - (blogs), published - (blogs) and names - (author name & blog title)
router.get('/author-homepage', (req, res) => {
    // Fetching updated data and render the Author Homepage
    fetchData((err, drafted, published, names) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('author-homepage', { drafted, published, names });
    });
});


///////////////////////////////////////////////////// READER SECTION //////////////////////////////////////////////////////

// For redirecting the user back to the reader-homepage
router.get("/back-to-reader-homepage", (req, res) => {
    res.redirect('reader-homepage');
});

// For redirecting the user back to the main homepage
router.get("/back-to-homepage", (req, res) => {
    res.redirect('/');
});

// Reader's homepage route to fetch the relevant data using the above mentioned helper functions
router.get("/reader-homepage", fetchPublishedblogs, fetchAuthorNames, (req, res) => {
    // Access fetched data from req object
    const blogs = req.publishedblogs;
    const names = req.authorNames;

    // Render the reader homepage with the fetched data
    res.render('reader-homepage', { blogs, names });
});

// Display blog details and increment view count when clicked on the reader-homepage blog list.
router.get("/reader-blog/:publish_id", fetchComments, (req, res) => {
    const publishId = req.params.publish_id;

    const publishid = String(req.params.publish_id);

    // Fetch the specific blog based on publishId
    const query = 'SELECT * FROM publishBlog WHERE publish_id = ?';
    db.get(query, [publishId], (err, blog) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Formatting the date of publication
        if(blog.published_at) blog.publishedAgo = dayjs(blog.published_at).format('MMM D, YYYY') ;

        // Initialize viewedBlogs if not exists
        if (!req.session.viewedBlogs) req.session.viewedBlogs = [];

        // Increment blog_reads only if not already viewed in this session
        if (!req.session.viewedBlogs.includes(publishId)) {
            req.session.viewedBlogs.push(publishId);

            // Increment blog_reads
            const readsQuery = `UPDATE publishBlog SET blog_reads = blog_reads + 1 WHERE publish_id = ?`;
            db.run(readsQuery, [publishId], (err) => {
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
router.get('/edit-blog/:id', (req, res) => {
    const blogId = req.params.id;

    // query to edit the blog with the given ID
    const query = 'SELECT * FROM blog WHERE blog_id = ?';
    db.get(query, [blogId], (err, blog) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Formatting the date of creation & modification
        if(blog.created_at) blog.createdAgo = dayjs(blog.created_at).format('MMM D, YYYY');
        if(blog.modified_at) blog.modifiedAgo = dayjs(blog.modified_at).fromNow();

        res.render('edit-article', { blog }); // Pass the blog object to the template

    });
});


///////////////////////////// ROUTES FOR TAKING ACTION BASED ON THE USER INTERACTION /////////////////////////////        


///////////////////////////////////////////////////// AUTHOR SECTION //////////////////////////////////////////////////////

// Route for to post content of the draft blog e.g. title, content and status of the blog into blog SQL table from the Create Draft page's input fields
router.post('/submit-blog', [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('blogTitle').trim().escape(),
    body('blogBody').trim().escape()
], (req, res) => {
    const blogTitle = req.body.blogTitle;
    const blogBody = req.body.blogBody;

    // Set the default value for blog_status as 'draft' and insert the blog title, content from the input field
    const query = 'INSERT INTO blog (blog_title, blog_content, blog_status) VALUES (?, ?, ?)';
    const blogStatus = 'Draft';
    db.run(query, [blogTitle, blogBody, blogStatus], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Fetching updated data and render the Author Homepage
        fetchData((err, drafted, published, names) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('author-homepage', { drafted, published, names });
        });
    });
});

// Route to delete to delete blogs from blog SQL table which are being displayed in draft blog section of the Author Homepage
router.post('/delete-blog', (req, res) => {
    const blogId = req.body.blog_id;

    // query for deleting blog from the blog table
    const query = 'DELETE FROM blog WHERE blog_id = ?';
    db.run(query, [blogId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Fetching updated data and render the Author Homepage
        fetchData((err, drafted, published, names) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('author-homepage', { drafted, published, names });
        });
    });
});

// Route to update blog title and content based on the user input in the input feilds of the Edit blog page
router.post('/update-blog/:id', [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('title').trim().escape(),
    body('content').trim().escape()
], (req, res) => {
    const blogId = req.params.id;
    const updatedTitle = req.body.title;
    const updatedContent = req.body.content;

    // query to update and add blog details in the blog table
    const query = 'UPDATE blog SET blog_title = ?, blog_content = ?, modified_at = CURRENT_TIMESTAMP WHERE blog_id = ?';
    db.run(query, [updatedTitle, updatedContent, blogId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Fetching updated data and render the Author Homepage
        fetchData((err, drafted, published, names) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.render('author-homepage', { drafted, published, names });

        });

    });

});

// Route to move an blog from 'blog' (drafts) to 'publishBlog' (published), updating its status by fetching the draft blogs, inserting it into 'publishBlog', and removing from 'blog'.
router.post('/publish-blog', (req, res) => {
    const blogId = req.body.blog_id;

    // Retrieve the blog to be published
    const selectQuery = 'SELECT * FROM blog WHERE blog_id = ?';
    db.get(selectQuery, [blogId], (err, blog) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        
        // If blog retrieved without error
        if (blog) {
           
            // SQL transaction for one or more SQL operations executed as single unit of work
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                // Insert into publishBlog table
                const insertQuery = `
                    INSERT INTO publishBlog (blog_title, blog_content, created_at, published_at, modified_at, blog_status)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
                `;
                const values = [
                    blog.blog_title,
                    blog.blog_content,
                    blog.created_at,
                    blog.modified_at,
                    'published'
                ];

                db.run(insertQuery, values, (err) => {
                    if (err) {
                        console.error(err.message);
                        db.run("ROLLBACK");
                        return res.status(500).send('Internal Server Error');
                    }

                    // Delete the blog from the blog table
                    const deleteQuery = 'DELETE FROM blog WHERE blog_id = ?';
                    db.run(deleteQuery, [blogId], (err) => {
                        if (err) {
                            console.error(err.message);
                            db.run("ROLLBACK");
                            return res.status(500).send('Internal Server Error');
                        }

                        db.run("COMMIT", (err) => {

                            if(err){
                                console.error(err.message);
                                return res.status(500).send("Internal Server Error");
                            }

                            // Fetching updated data and render the Author Homepage
                            fetchData((err, drafted, published, names) => {
                                if (err) {
                                    console.error(err);
                                    return res.status(500).send('Internal Server Error');
                                }
                                res.render('author-homepage', { drafted, published, names });
                            });

                        });
                    });
                });

            });
        } else {
            // Handle the case where the blog is not found
            res.status(404).send('blog not found');
        }
    });
});

// Route to Author Blog Settings page to change the previuosly set or add new author name and blog title to the names SQL table and display it on the Author Homepage.
router.post('/author-blog-setting', [
    // Sanitizing the input - removes leading/trailing spaces and escapes HTML
    body('author_name').trim().escape(),
    body('author_about').trim().escape()
], (req, res) => {

    // Retrieve author_name and blog_title from request body
    const { author_name, author_about } = req.body;

    // SQL transaction for one or more SQL operations executed as single unit of work
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // First, delete all existing records in the names table
        const deleteQuery = 'DELETE FROM names';
        db.run(deleteQuery, [], (err) => {
            if (err) {
                console.error(err);
                db.run("ROLLBACK");
                return res.status(500).send('Internal Server Error');
            }

            // After deletion, insert the new record
            const insertQuery = 'INSERT INTO names (author_name, author_about) VALUES (?, ?)';
            db.run(insertQuery, [author_name, author_about], (err) => {
                if (err) {
                    console.error(err);
                    db.run("ROLLBACK");
                    return res.status(500).send('Internal Server Error');
                }

                db.run("COMMIT", (err) => {

                    if(err){
                        console.error(err.message);
                        return res.status(500).send("Internal Server Error");
                    }

                    // Fetching updated data and render the Author Homepage
                    fetchData((err, drafted, published, names) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).send('Internal Server Error');
                        }
                        res.render('author-homepage', { drafted, published, names });
                    });

                });
            });
        });

    });
});

// Route to delete published blogs from the publishBlog SQL table and stop them being displayed on the published blogs section
router.post('/delete-publishedblog', (req, res) => {
    const blogId = req.body.publish_id;

    // SQL transaction for one or more SQL operations executed as single unit of work
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // query to delete related comments first
        const deleteQuery = 'DELETE FROM comments WHERE publish_id = ?';
        db.run(deleteQuery, [blogId], (err) => {
            if (err) { 
                console.error(err.message);
                db.run("ROLLBACK"); 
                return res.status(500).send('Internal Server Error'); 
            }
        });

        // query for deleting blogs from the publish blog table
        const insertQuery = 'DELETE FROM publishBlog WHERE publish_id = ?';
        db.run(insertQuery, [blogId], (err) => {
            if (err) {
                console.error(err.message);
                db.run("ROLLBACK");
                return res.status(500).send('Internal Server Error');
            }
        });

        db.run("COMMIT", (err) => {
            if (err) { return res.status(500).send('Internal Server Error'); }

            // Fetching updated data and render the Author Homepage
            fetchData((err, drafted, published, names) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                res.render('author-homepage', { drafted, published, names });

            });
        });

    });
});


///////////////////////////////////////////////////// READER SECTION //////////////////////////////////////////////////////

// Adding comments like in other to diplay them using sql to update comments like counts and the redirecting the user
router.post('/comment-like/:id', (req, res) => {
    const commentId = req.params.id;

    // Converting the comment id into for storing into liked comments array
    const commentid = String(req.params.id);

    // Checking if likedcomments array exists, if not then initializing an empty array
    if(!req.session.likedcomments) req.session.likedcomments = [];

    // If likedcomments array includes the comment id, if yes then redirect to the current page and do nothing
    if(req.session.likedcomments.includes(commentid)) return res.redirect(req.get('referer'));
    // Else add the comment id to the array of liked comments
    req.session.likedcomments.push(commentid);

    // Udpating the likes count
    const query = `UPDATE comments SET comment_likes = comment_likes + 1 WHERE comment_id = ?`;
    db.run(query, [commentId], (err) => {
        if (err) {
            res.status(500).send('Error updating likes');
            return;
        }

        // Redirect back to the same blog page after adding a comment
        res.redirect(req.get('referer'));
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
    const publishId = req.body.publish_id;

    // Inserting the comments data into the comments table
    const query = 'INSERT INTO comments (commentator_name, comment, publish_id) VALUES (?, ?, ?)';
    db.run(query, [name, content, publishId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Redirect back to the same blog page after adding a comment
        res.redirect(req.get('referer'));
    });
});

/* Adding Likes using sql to update likes count based on the publish_id params of the comment and then redirecting the user back to the same blog page */
router.post('/like-blog/:id', (req, res) => {
    const publishId = String(req.params.id);
    const publishid = req.params.id;

    if (!req.session.likedBlogs) req.session.likedBlogs = [];
    if (req.session.likedBlogs.includes(publishId)) return res.redirect(req.get('referer'));

    req.session.likedBlogs.push(publishId);

    // Updating the likes count in the comments table based on the publish id parameter
    const query = 'UPDATE publishBlog SET blog_likes = blog_likes + 1 WHERE publish_id = ?';
    db.run(query, [publishid], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
            
            res.redirect(req.get('referer'));

    });
});

// Export the router object so index.js can access it
module.exports = router;

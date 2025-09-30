-- Enable foreign key constraints
PRAGMA foreign_keys=ON;

-- Begin a transaction
BEGIN TRANSACTION;

-- For storing author & blog title
CREATE TABLE IF NOT EXISTS names (
    names_id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL,
    author_about TEXT NOT NULL
);

-- For storing drafted blogs/blogs
CREATE TABLE IF NOT EXISTS blog (
    blog_id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_title TEXT NOT NULL,
    blog_content TEXT NOT NULL,
    created_at DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    modified_at TIMESTAMP,
    blog_status TEXT NOT NULL
);

-- For storing published blogs/blogs
CREATE TABLE IF NOT EXISTS publishBlog (
    publish_id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_id INTEGER,
    blog_title TEXT NOT NULL,
    blog_content TEXT NOT NULL,
    created_at TIMESTAMP,
    published_at DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP,
    blog_status TEXT NOT NULL,
    blog_reads INTEGER DEFAULT 0,
    blog_likes INTEGER DEFAULT 0,
    FOREIGN KEY (blog_id) REFERENCES blog(blog_id)
);

-- For storing comments
CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    publish_id INTEGER,
    commentator_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    comment_likes INTEGER DEFAULT 0,
    commented_at DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publish_id) REFERENCES publishBlog(publish_id)
);

-- Initial Dumy data for author name & blog title 
INSERT INTO names (author_name, author_about) VALUES ('Author Name', 'Author About');

 
-- Commit the transaction
COMMIT;
 -- Enable foreign key constraints
PRAGMA foreign_keys=ON;

-- Begin a transaction
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK  (role IN ('AUTHOR', 'READER')),
    about TEXT,
    security_answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    password VARCHAR(255) NOT NULL
);

-- For password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- For storing author & blog title
-- CREATE TABLE IF NOT EXISTS names (
--     names_id INTEGER PRIMARY KEY AUTOINCREMENT,
--     author_id INTEGER NOT NULL,
--     author_name TEXT NOT NULL,
--     author_about TEXT NOT NULL,
--     FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- -- For storing drafted blogs/blogs
-- CREATE TABLE IF NOT EXISTS blog (
--     blog_id INTEGER PRIMARY KEY AUTOINCREMENT,
--     author_id INTEGER NOT NULL,
--     blog_title TEXT NOT NULL,
--     blog_content TEXT NOT NULL,
--     created_at DEFAULT CURRENT_TIMESTAMP,
--     published_at TIMESTAMP,
--     modified_at TIMESTAMP,
--     blog_status TEXT NOT NULL,
--     FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- -- For storing published blogs/blogs
-- CREATE TABLE IF NOT EXISTS publishBlog (
--     publish_id INTEGER PRIMARY KEY AUTOINCREMENT,
--     author_id INTEGER NOT NULL,
--     blog_id INTEGER,
--     blog_title TEXT NOT NULL,
--     blog_content TEXT NOT NULL,
--     created_at TIMESTAMP,
--     published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     modified_at TIMESTAMP,
--     blog_status TEXT NOT NULL,
--     blog_reads INTEGER DEFAULT 0,
--     blog_likes INTEGER DEFAULT 0,
--     FOREIGN KEY (blog_id) REFERENCES blog(blog_id)
-- );

-- ONE table for ALL blogs (drafts and published)
CREATE TABLE IF NOT EXISTS blog (
    blog_id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    blog_title TEXT NOT NULL,
    blog_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    modified_at TIMESTAMP,
    blog_status TEXT NOT NULL CHECK (blog_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    blog_reads INTEGER DEFAULT 0,
    blog_likes INTEGER DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- For storing comments
CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_id INTEGER NOT NULL,
    user_id INTEGER,
    commentator_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    comment_likes INTEGER DEFAULT 0,
    commented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blog_id) REFERENCES blog(blog_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Commit the transaction
COMMIT;
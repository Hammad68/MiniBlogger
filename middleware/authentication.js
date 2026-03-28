// Check if the user is logged in
const requireAuthentication = (req, res, next) => {
    if(!req.session.userId){
        res.redirect('/');
    }
    next();
}

// Checks if the logged in user an author
const requireAuthor = (req, res, next) => {
    if(!req.session.userId || req.session.role !== 'AUTHOR'){
        return res.status(403).send("Can only be accessed by authors");
    }
    next();
}

module.exports = { requireAuthentication, requireAuthor };
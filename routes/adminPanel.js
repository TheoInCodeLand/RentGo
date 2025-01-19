const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

// Database connection
const db = new sqlite3.Database('./database/rental.db');

// Middleware to ensure admin access
function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/auth/login');
}

module.exports = router;

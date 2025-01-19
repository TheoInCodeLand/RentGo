const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const path = require('path');

const db = new sqlite3.Database('./database/rental.db');
const adminRoutes = require('./admin');
console.log(bcrypt.hashSync('your_password', 10)); // Replace 'your_password' with the desired password


// --- Routes ---

// Registration Page
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Handle Registration
router.post('/register', (req, res) => {
    const { username, password, name, surname, email, phone, address, age } = req.body;

    // Input validation
    if (!username || !password || !name || !surname || !email || !phone || !address || !age) {
        return res.render('register', { error: 'All fields are required!' });
    }

    if (password.length < 6) {
        return res.render('register', { error: 'Password must be at least 6 characters long!' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user into database
    db.run(
        `
        INSERT INTO users (username, password, name, surname, email, phone, address, age, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'customer')
        `,
        [username, hashedPassword, name, surname, email, phone, address, age],
        (err) => {
            if (err) {
                console.error(err.message);
                if (err.message.includes('UNIQUE')) {
                    return res.render('register', { error: 'Username or email already exists!' });
                }
                return res.render('register', { error: 'Something went wrong. Please try again.' });
            }
            res.redirect('/auth/login');
        }
    );
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Handle Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Find user in database
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error(err.message);
            return res.render('login', { error: 'Something went wrong. Please try again.' });
        }

        if (!user) {
            return res.render('login', { error: 'Invalid username or password.' });
        }

        // Compare provided password with hashed password in DB
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error(err.message);
                return res.render('login', { error: 'Something went wrong. Please try again.' });
            }

            if (!isMatch) {
                return res.render('login', { error: 'Invalid username or password.' });
            }

            // Save user session
            req.session.user = {
                id: user.id,
                username: user.username,
                name: user.name,
                surname: user.surname,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role: user.role,
            };

            // Redirect based on user role
            if (user.role === 'admin') {
                return res.redirect('/admin/cars');
            }

            // Redirect to home page for non-admin users
            res.redirect('/');
        });
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;

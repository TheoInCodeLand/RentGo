const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

// Database connection
const db = new sqlite3.Database('./database/rental.db');

// Middleware to check if the user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

// Route to display user profile
router.get('/', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.get(
        `SELECT * FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error retrieving user profile.');
            }

            res.render('profile', { user });
        }
    );
});

// Route to update user profile
router.post('/update', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { name, email, phone, address } = req.body;

    if (!name || !email) {
        return res.status(400).send('Name and email are required.');
    }

    db.run(
        `UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`,
        [name, email, phone, address, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error updating profile.');
            }

            res.redirect('/profile');
        }
    );
});

// Route to change user password
router.post('/change-password', ensureAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).send('All fields are required.');
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).send('New passwords do not match.');
    }

    db.get(`SELECT password FROM users WHERE id = ?`, [userId], async (err, user) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error retrieving user data.');
        }

        // Check if current password is correct
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).send('Current password is incorrect.');
        }

        // Hash and update the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run(
            `UPDATE users SET password = ? WHERE id = ?`,
            [hashedPassword, userId],
            (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('Error updating password.');
                }

                res.redirect('/profile');
            }
        );
    });
});

module.exports = router;

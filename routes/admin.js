const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = new sqlite3.Database('./database/rental.db');
const transporter = require('../utils/email'); // Import the email module

// Configure multer for storing multiple images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Directory to save uploaded images
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage });

// Middleware to ensure admin access
function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/auth/login');
}

// Admin Dashboard: Show all cars
router.get('/cars', ensureAdmin, (req, res) => {
    db.all('SELECT * FROM cars ORDER BY id DESC', [], (err, cars) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('An error occurred while retrieving cars.');
        }
        res.render('admin', { cars, user: req.session.user });
    });
});

// Add a new car with multiple images
router.post('/add-car', ensureAdmin, upload.array('images', 9), (req, res) => {
    try {
        const {
            brand, model, year, name, type, transmission, fuel_type,
            seating_capacity, mileage, price_per_day, car_price, description
        } = req.body;

        const upload_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const upload_time = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS

        // Insert car details into the database
        db.run(`
            INSERT INTO cars (
                brand, 
                model, 
                year, 
                name, 
                type, 
                transmission, 
                fuel_type,
                seating_capacity, 
                mileage, 
                price_per_day,
                car_price,
                description,
                upload_date, 
                upload_time,available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"available")
        `, [
                brand, 
                model, 
                year, 
                name, 
                type, 
                transmission, 
                fuel_type,
                seating_capacity, 
                mileage, 
                price_per_day, 
                car_price,
                description,
                upload_date, upload_time
            ], function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send("Error adding car to the database.");
            }

            const carId = this.lastID; // Newly added car's ID

            // Handle image uploads
            const images = req.files;
            if (images && images.length > 0) {
                const insertImageStmt = db.prepare(`
                    INSERT INTO car_images (car_id, image_url)
                    VALUES (?, ?)
                `);

                images.forEach(image => {
                    const imageUrl = `/uploads/${image.filename}`;
                    insertImageStmt.run(carId, imageUrl);
                });

                insertImageStmt.finalize();
            }

            res.redirect('/admin/cars');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Unexpected error occurred.');
        res.redirect('error404');
    }
});

// Delete a car
router.post('/delete-car/:id', ensureAdmin, (req, res) => {
    const carId = req.params.id;

    db.run('DELETE FROM cars WHERE id = ?', [carId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Failed to delete car.');
        }
        res.redirect('/admin/cars');
    });
});

// View all bookings
router.get('/bookings', ensureAdmin, (req, res) => {
    db.all(
        `
        SELECT bookings.*, 
               cars.name AS car_name, 
               cars.brand AS car_brand, 
               users.name AS user_name, 
               users.email AS user_email,
               bookings.returned_status, 
               bookings.late_fee
        FROM bookings
        JOIN cars ON bookings.car_id = cars.id
        JOIN users ON bookings.customer_id = users.id
        ORDER BY bookings.id DESC
        `,
        [],
        (err, bookings) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred while retrieving bookings.');
            }

            res.render('admin-bookings', { bookings, user: req.session.user });
        }
    );
});

// Approve a booking
router.post('/bookings/approve/:id', ensureAdmin, (req, res) => {
    const bookingId = req.params.id;

    // Fetch booking details along with user and car info
    db.get(
        `
        SELECT bookings.*, users.email AS user_email, users.name AS user_name, cars.name AS car_name
        FROM bookings
        JOIN users ON bookings.customer_id = users.id
        JOIN cars ON bookings.car_id = cars.id
        WHERE bookings.id = ?
        `,
        [bookingId],
        (err, booking) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred.');
            }

            if (!booking) {
                return res.status(404).send('Booking not found.');
            }

            // Update booking status to 'accepted'
            db.run(
                `UPDATE bookings SET status = 'accepted' WHERE id = ?`,
                [bookingId],
                (updateErr) => {
                    if (updateErr) {
                        console.error(updateErr.message);
                        return res.status(500).send('Failed to approve the booking.');
                    }

                    // Send an email notification to the user
                    const mailOptions = {
                        from: 'thobejanetheo@gmail.com', // Replace with your email
                        to: booking.user_email,
                        subject: 'Booking Approved - Payment Required',
                        text: `Hi ${booking.customer_name},

Your booking for "${booking.car_name}" has been approved. Please complete your payment on our website or in-store to confirm your booking.

Booking Details:
-Start Date: ${booking.rental_date}
-Return Date: ${booking.return_date}
-Total Cost: R ${booking.total_cost}

Thank you,
The Car Rental. Team
                        `,
                    };

                    transporter.sendMail(mailOptions, (emailErr, info) => {
                        if (emailErr) {
                            console.error('Error sending email:', emailErr.message);
                            return res.status(500).send('Booking approved, but email notification failed.');
                        }

                        console.log('Email sent:', info.response);
                        res.render('animated-tick', { redirectUrl: `/admin/bookings` }); // Redirect to the bookings pag
                    });
                }
            );
        }
    );
});

// Cancel a booking
router.post('/bookings/decline/:id', ensureAdmin, (req, res) => {
    const bookingId = req.params.id;

    db.run(
        `UPDATE bookings SET status = 'declined' WHERE id = ?`,
        [bookingId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Failed to decline the booking.');
            }
            res.redirect('/admin/bookings');
        }
    );
});

// Route to update booking return status
router.post('/bookings/return/:id', ensureAdmin, (req, res) => {
    const bookingId = req.params.id;

    db.get(
        `SELECT * FROM bookings WHERE id = ?`,
        [bookingId],
        (err, booking) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error retrieving booking details.');
            }

            if (!booking) {
                return res.status(404).send('Booking not found.');
            }

            // Calculate late fee if return date is exceeded
            const currentDate = new Date();
            const expectedReturnDate = new Date(booking.return_date);
            let lateFee = 0;

            if (currentDate > expectedReturnDate) {
                const daysLate = Math.ceil(
                    (currentDate - expectedReturnDate) / (1000 * 60 * 60 * 24)
                );
                lateFee = daysLate * 200; // Example late fee: 200 ZAR per day
            }

            const returnedStatus = lateFee > 0 ? 'late' : 'returned';

            // Update booking return status and set car to available
            db.run(
                `
                UPDATE bookings 
                SET returned_status = ?, late_fee = ? 
                WHERE id = ?
                `,
                [returnedStatus, lateFee, bookingId],
                (updateErr) => {
                    if (updateErr) {
                        console.error(updateErr.message);
                        return res.status(500).send('Error updating booking status.');
                    }

                    // Set car status to "available"
                    db.run(
                        `
                        UPDATE cars 
                        SET available = 'available' 
                        WHERE id = ?
                        `,
                        [booking.car_id],
                        (carUpdateErr) => {
                            if (carUpdateErr) {
                                console.error(carUpdateErr.message);
                                return res.status(500).send('Error updating car availability.');
                            }

                            res.redirect('/admin/bookings');
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;

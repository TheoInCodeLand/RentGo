const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const db = new sqlite3.Database('./database/rental.db');

// Middleware to check if the user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

// Get the booking form for a specific car
router.get('/book/:carId', ensureAuthenticated, (req, res) => {
    const carId = req.params.carId;

    // Fetch car details from the database
    db.get('SELECT * FROM cars WHERE id = ?', [carId], (err, car) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error retrieving car details.');
        }

        if (!car) {
            return res.status(404).send('Car not found.');
        }

        // Assuming `req.session.user` contains the logged-in user's details
        const user = req.session.user;
        
        res.render('booking-form', {
            user,
            car
        });
    });
});

// Delete a booking
router.post('/user/bookings/delete/:id', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    // Delete the booking if it belongs to the logged-in user
    db.run(
        `
        DELETE FROM bookings
        WHERE id = ? AND customer_id = ?
        `,
        [bookingId, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error deleting booking.');
            }

            res.redirect('/user/bookings');
            console.log('Booking ID:', bookingId);
            console.log('User ID:', userId);

        }
    );
});


// Booking form submission
router.post('/book/:carId', ensureAuthenticated, (req, res) => {
    const { carId } = req.params;
    const { customer_name, customer_surname, rentalDate, returnDate, user_email } = req.body;
    const customerId = req.session.user.id;

    // Validate required fields
    if (!customer_name || !customer_surname || !rentalDate || !returnDate || !user_email) {
        return res.status(400).send('Please provide all required fields.');
    }

    // Validate date logic
    const start = new Date(rentalDate);
    const end = new Date(returnDate);

    if (end <= start) {
        return res.status(400).send('Return date must be after the rental date.');
    }

    // Calculate rental duration
    const rentalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // Convert milliseconds to days

    db.serialize(() => {
        // Fetch car details to calculate the total cost
        db.get(
            `SELECT price_per_day FROM cars WHERE id = ?`,
            [carId],
            (err, car) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('Error fetching car details.');
                }

                if (!car) {
                    return res.status(404).send('Car not found.');
                }

                const totalCost = rentalDays * car.price_per_day;

                // Check if the car is already booked during the requested period
                db.get(
                    `
                    SELECT * FROM bookings
                    WHERE car_id = ? AND status = 'accepted' 
                    AND (rental_date <= ? AND return_date >= ?)
                    `,
                    [carId, returnDate, rentalDate],
                    (err, existingBooking) => {
                        if (err) {
                            console.error(err.message);
                            return res.status(500).send('Error checking availability.');
                        }

                        if (existingBooking) {
                            return res.status(400).send('Car is already booked for the selected dates.');
                        }

                        // Insert the booking into the database
                        db.run(
                            `
                            INSERT INTO bookings (
                                car_id, 
                                customer_id, 
                                rental_date, 
                                return_date, 
                                total_cost, 
                                user_email,
                                customer_name,
                                customer_surname
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `,
                            [carId, customerId, rentalDate, returnDate, totalCost, user_email, customer_name, customer_surname],
                            function (err) {
                                if (err) {
                                    console.error(err.message);
                                    return res.status(500).send('Error saving the booking.');
                                }

                                res.render('animated-tick', { redirectUrl: `/car/${carId}` });
                            }
                        );
                    }
                );
            }
        );
    });
});


router.get('/pay/:bookingId', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.bookingId;
    const userId = req.session.user.id;

    db.get(
        `SELECT * FROM bookings WHERE id = ? AND customer_id = ?`,
        [bookingId, userId],
        (err, booking) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error retrieving booking details.');
            }

            if (!booking) {
                return res.status(404).send('Booking not found.');
            }

            if (booking.status !== 'accepted') {
                return res.status(400).send('Payment is not allowed for this booking.');
            }

            res.render('payment-page', { booking });
        }
    );
});

router.post('/pay/:bookingId', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.bookingId;
    const userId = req.session.user.id;

    const { cardNumber, expiryDate, cvv } = req.body;

    if (!cardNumber || !expiryDate || !cvv) {
        return res.status(400).send('Please provide all payment details.');
    }

    db.run(
        `UPDATE bookings SET payment_status = 'paid' WHERE id = ? AND customer_id = ?`,
        [bookingId, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error processing payment.');
            }

            res.send('Payment successful! Your booking is confirmed.');
        }
    );
});

// Allow Users to Cancel Pending Bookings
router.post('/user/bookings/cancel/:id', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    db.run(
        `
        UPDATE bookings
        SET status = 'cancelled'
        WHERE id = ? AND customer_id = ? AND status = 'pending'
        `,
        [bookingId, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error cancelling booking.');
            }

            res.redirect('/user/bookings');
        }
    );
});

// This route allows users to pay for approved bookings.
router.post('/user/bookings/pay/:id', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    // Simulate successful payment processing
    db.run(
        `
        UPDATE bookings
        SET payment_status = 'paid'
        WHERE id = ? AND customer_id = ? AND status = 'accepted'
        `,
        [bookingId, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error processing payment.');
            }
            res.render('animated-tick', { redirectUrl: `/all-cars` });
        }
    );
});


module.exports = router;

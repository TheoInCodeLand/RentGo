const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const db = new sqlite3.Database('./database/rental.db');

// Middleware to ensure user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

// Payment Gateway Configuration
const PAYFAST_MERCHANT_ID = '10036421'; // Replace with your Merchant ID
const PAYFAST_MERCHANT_KEY = 'trtcpc2rx80lm'; // Replace with your Merchant Key

const PAYFAST_CANCEL_URL = 'http://localhost:8000/payment/cancel';
const PAYFAST_NOTIFY_URL = 'http://localhost:8000/payment/notify';

// Route to initiate payment
router.post('/initiate', ensureAuthenticated, async (req, res) => {
    const { bookingId, itemName, amount } = req.body;

    // Validate amount and booking details
    if (!bookingId || !amount || !itemName) {
        return res.status(400).send("Booking ID and amount are required.");
    }

    try {
        // Prepare payment data
        const paymentData = {
            merchant_id: PAYFAST_MERCHANT_ID,
            merchant_key: PAYFAST_MERCHANT_KEY,
            amount: parseFloat(amount).toFixed(2), // Format amount to 2 decimal places
            item_name: `Payment for Booking ${itemName} booking id is ${bookingId}.`,
            return_url: `http://localhost:8000/payment/success?bookingId=${bookingId}`,
            cancel_url: PAYFAST_CANCEL_URL,
            notify_url: PAYFAST_NOTIFY_URL,
            custom_int1: bookingId, // Pass booking ID as metadata
        };

        // Redirect to PayFast Payment Page
        const queryString = new URLSearchParams(paymentData).toString();
        const payfastUrl = `https://sandbox.payfast.co.za/eng/process?${queryString}`;
        res.redirect(payfastUrl);
    } catch (error) {
        console.error("Payment initiation failed:", error.message);
        res.status(500).send("Failed to initiate payment.");
    }
});

// Route to handle success notification
router.get('/success', ensureAuthenticated, (req, res) => {
    console.log('Query Parameters:', req.query); // Log query parameters
    const bookingId = req.query.bookingId;

    if (!bookingId) {
        console.error('No booking ID returned after payment success.');
        return res.status(400).send('Invalid booking ID.');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Processing Payment</title>
        </head>
        <body onload="document.getElementById('payment-confirm-form').submit();">
            <form id="payment-confirm-form" action="/booking/user/bookings/pay/${bookingId}" method="POST">
                <!-- Hidden form for automatic submission -->
            </form>
        </body>
        </html>
    `);
});

// Route to handle cancel notification
router.get('/cancel', ensureAuthenticated, (req, res) => {
    res.send("Payment cancelled. Please try again.");
});

// Route to handle payment notification from PayFast
router.post('/notify', (req, res) => {
    console.log('Notification Data:', req.body);
    const { custom_int1: bookingId, payment_status } = req.body;

    if (payment_status === 'COMPLETE') {
        db.run(
            `UPDATE bookings SET payment_status = 'paid', status = 'completed' WHERE id = ?`,
            [bookingId],
            (err) => {
                if (err) {
                    console.error('Error updating booking:', err.message);
                    return res.status(500).send('Error updating booking.');
                }
                console.log(`Booking #${bookingId} marked as paid.`);
                res.status(200).send('Payment processed successfully.');
            }
        );
    } else {
        console.error('Payment not completed.');
        res.status(400).send('Payment not completed.');
    }
});


// Route to confirm payment
router.post('/user/bookings/payment-confirm/:id', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    // Confirm payment
    db.run(
        `
        UPDATE bookings
        SET payment_status = 'paid', status = 'completed'
        WHERE id = ? AND customer_id = ? AND status = 'accepted'
        `,
        [bookingId, userId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error updating payment status.');
            }

            res.redirect('/user/bookings');
        }
    );
});

// Route to fetch and display payment page
router.post('/user/bookings/pay/:id', ensureAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const userId = req.session.user.id;

    // Fetch booking details to validate and prepare payment
    db.get(
        `
        SELECT * FROM bookings 
        WHERE id = ? AND customer_id = ? AND status = 'accepted'
        `,
        [bookingId, userId],
        (err, booking) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error fetching booking details.');
            }

            if (!booking) {
                return res.status(400).send('Invalid booking or already paid.');
            }

            // Render or redirect to a payment page with booking details
            res.render('payment-page', { booking });
        }
    );
});

module.exports = router;

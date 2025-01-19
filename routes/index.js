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

function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/auth/login');
}

// Homepage: List available cars
router.get('/', (req, res) => {
    db.all(`
        SELECT cars.*, GROUP_CONCAT(car_images.image_url) AS image_urls
        FROM cars 
        LEFT JOIN car_images ON cars.id = car_images.car_id
        GROUP BY cars.id
        ORDER BY cars.id DESC
        LIMIT 6
    `, [], (err, cars) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('An error occurred while retrieving cars.');
        }

        // Convert image URLs into an array for rendering
        cars.forEach(car => {
            car.image_urls = car.image_urls ? car.image_urls.split(',') : [];
        });

        res.render('index', { cars, user: req.session.user || null });
    });
});


// Car Details Page
router.get('/car/:id', (req, res) => {
    const carId = req.params.id;

    db.get('SELECT * FROM cars WHERE id = ?', [carId], (err, car) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('An error occurred while retrieving the car.');
        }

        if (!car) {
            return res.status(404).send('Car not found.');
        }

        db.all('SELECT image_url FROM car_images WHERE car_id = ?', [carId], (err, images) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred while retrieving images.');
            }

            const imageUrls = images.map(img => img.image_url);

            // Fetch reviews for the car
            db.all('SELECT * FROM reviews WHERE car_id = ?', [carId], (err, reviews) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('An error occurred while retrieving reviews.');
                }

                res.render('car', { car, imageUrls, reviews, user: req.session.user });
            });
        });
    });
});

router.get("/search", (req, res) => {
    const { name, model, location, year, type, price } = req.query;

    // Start with a base query, including JOIN for car_images
    let query = `
        SELECT cars.*, GROUP_CONCAT(car_images.image_url) AS image_urls
        FROM cars
        LEFT JOIN car_images ON cars.id = car_images.car_id
        WHERE 1=1
    `;
    const params = [];

    // Append filters dynamically
    if (name) {
        query += " AND cars.name LIKE ?";
        params.push(`%${name}%`);
    }
    if (model) {
        query += " AND cars.type = ?";
        params.push(model);
    }
    if (location) {
        query += " AND cars.location = ?";
        params.push(location);
    }
    if (year) {
        query += " AND cars.year = ?";
        params.push(year);
    }
    if (type) {
        query += " AND cars.type = ?";
        params.push(type);
    }
    if (price) {
        query += " AND cars.price_per_day <= ?";
        params.push(price);
    }

    // Add GROUP BY to handle images grouping
    query += `
        GROUP BY cars.id
        ORDER BY cars.id DESC
    `;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Error searching cars with images");
        }

        // Process images into arrays
        rows.forEach(car => {
            car.image_urls = car.image_urls ? car.image_urls.split(',') : [];
        });

        // Render filtered results with images
        res.render("filtered-cars", { cars: rows });
    });
});

router.get('/user/bookings', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.all(
        `
        SELECT bookings.*, cars.name AS car_name, cars.brand AS car_brand
        FROM bookings
        JOIN cars ON bookings.car_id = cars.id
        WHERE bookings.customer_id = ?
        ORDER BY bookings.id DESC
        `,
        [userId],
        (err, bookings) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error retrieving bookings.');
            }

            res.render('manage-bookings', { bookings, user: req.session.user });
        }
    );
});

router.get('/user/bookings/:userId', ensureAuthenticated, (req, res) => {
    const userId = req.params.userId;

    // Query to fetch user information
    db.get(
        `SELECT * FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error fetching user information.');
            }

            if (!user) {
                return res.status(404).send('User not found.');
            }

            // Query to fetch bookings for the user
            db.all(
                `
                SELECT bookings.*, 
                       cars.brand AS car_brand, 
                       cars.name AS car_name, 
                       cars.price_per_day
                FROM bookings
                JOIN cars ON bookings.car_id = cars.id
                WHERE bookings.customer_id = ?
                ORDER BY bookings.id DESC
                `,
                [userId],
                (err, bookings) => {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).send('Error fetching bookings.');
                    }

                    // Render the user panel with user info and bookings
                    res.render('profile', { user, bookings });
                }
            );
        }
    );
});

module.exports = router;

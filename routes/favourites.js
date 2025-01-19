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

// Add a car to favorites
router.post('/add', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { carId } = req.body;

    if (!carId) {
        return res.status(400).send('Car ID is required.');
    }

    db.run(
        `INSERT INTO favorites (user_id, car_id) VALUES (?, ?)`,
        [userId, carId],
        (err) => {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    return res.status(400).send('This car is already in your favorites.');
                }
                console.error(err.message);
                return res.status(500).send('Failed to add car to favorites.');
            }
            return res.status(400).send('You have successfully added car to favourites.'); // Redirect to the favorites page or another relevant page
        }
    );
});

// Remove a car from favorites
router.post('/remove', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { carId } = req.body;

    if (!carId) {
        return res.status(400).send('Car ID is required.');
    }

    db.run(
        `DELETE FROM favorites WHERE user_id = ? AND car_id = ?`,
        [userId, carId],
        (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Failed to remove car from favorites.');
            }
            res.send('Car removed from favorites.');
        }
    );
});

// Get all favorite cars for the logged-in user
router.get('/', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.all(
        `
        SELECT cars.*, GROUP_CONCAT(car_images.image_url) AS image_urls
        FROM cars
        JOIN favorites ON cars.id = favorites.car_id
        LEFT JOIN car_images ON cars.id = car_images.car_id
        WHERE favorites.user_id = ?
        GROUP BY cars.id
        ORDER BY favorites.id DESC
        `,
        [userId],
        (err, cars) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred while retrieving favorite cars.');
            }

            cars.forEach(car => {
                car.image_urls = car.image_urls ? car.image_urls.split(',') : [];
            });

            res.render('favourites', { cars, user: req.session.user });
        }
    );
});

// Get all favorite cars for the logged-in user by filter
router.get('/search', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { name, brand, model, location, year, type, price } = req.query;

    let query = `
        SELECT cars.*, GROUP_CONCAT(car_images.image_url) AS image_urls
        FROM cars
        JOIN favorites ON cars.id = favorites.car_id
        LEFT JOIN car_images ON cars.id = car_images.car_id
        WHERE favorites.user_id = ?
    `;
    const params = [userId];

    // Add filters based on query parameters
    if (name) {
        query += ' AND cars.name LIKE ?';
        params.push(`%${name}%`);
    }
    if (brand) {
        query += ' AND cars.brand = ?';
        params.push(brand);
    }
    if (model) {
        query += ' AND cars.type = ?';
        params.push(model);
    }
    if (year) {
        query += ' AND cars.year = ?';
        params.push(year);
    }
    if (type) {
        query += ' AND cars.type = ?';
        params.push(type);
    }
    if (price) {
        query += ' AND cars.price_per_day <= ?';
        params.push(price);
    }

    query += ' GROUP BY cars.id ORDER BY cars.id DESC';

    db.all(query, params, (err, cars) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('An error occurred while searching for favorite cars.');
        }

        cars.forEach(car => {
            car.image_urls = car.image_urls ? car.image_urls.split(',') : [];
        });

        res.render('favourites', { cars, user: req.session.user });
    });
});

router.post('/toggle', ensureAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { carId } = req.body;

    if (!carId) {
        return res.status(400).send('Car ID is required.');
    }

    // Check if the car is already a favorite
    db.get(
        `SELECT * FROM favorites WHERE user_id = ? AND car_id = ?`,
        [userId, carId],
        (err, row) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred.');
            }

            if (row) {
                // If already a favorite, remove it
                db.run(
                    `DELETE FROM favorites WHERE user_id = ? AND car_id = ?`,
                    [userId, carId],
                    (err) => {
                        if (err) {
                            console.error(err.message);
                            return res.status(500).send('Failed to remove favorite.');
                        }
                        req.get("Referrer") || "/" // Redirect back to the same page
                        // res.redirect('back'); // Redirect back to the same page
                    }
                );
            } else {
                // If not a favorite, add it
                db.run(
                    `INSERT INTO favorites (user_id, car_id) VALUES (?, ?)`,
                    [userId, carId],
                    (err) => {
                        if (err) {
                            console.error(err.message);
                            return res.status(500).send('Failed to add favorite.');
                        }
                        res.redirect('back'); // Redirect back to the same page
                    }
                );
            }
        }
    );
});


module.exports = router;
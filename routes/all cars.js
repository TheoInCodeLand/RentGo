const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = new sqlite3.Database('./database/rental.db');
const transporter = require('../utils/email');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/auth/login');
}

function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

router.get('/', (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    db.all(
        `
        SELECT cars.*, 
            GROUP_CONCAT(car_images.image_url) AS image_urls,
            CASE 
                WHEN ? IS NOT NULL THEN EXISTS (
                    SELECT 1 FROM favorites 
                    WHERE favorites.user_id = ? AND favorites.car_id = cars.id
                )
                ELSE 0
            END AS isFavorite
        FROM cars
        LEFT JOIN car_images ON cars.id = car_images.car_id
        GROUP BY cars.id
        ORDER BY cars.id DESC
        `,
        [userId, userId],
        (err, cars) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred while retrieving cars.');
            }

            cars.forEach(car => {
                car.image_urls = car.image_urls ? car.image_urls.split(',') : [];
                car.isFavorite = Boolean(car.isFavorite);
            });

            res.render('cars', { cars, user: req.session.user || null });
        }
    );
});


module.exports = router;

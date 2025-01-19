const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const rentals = require('./routes/all cars');
const profileRoutes = require('./routes/profile');
const bookingRoutes = require('./routes/booking');
const paymentRoutes = require('./routes/payment');
const favouritesRoutes = require('./routes/favourites');
const adminPanelRoutes = require('./routes/adminPanel');

const app = express();
const PORT = 8000;

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.set('view engine', 'ejs'); // Set EJS as the view engine

// Session setup
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db' }),
    secret: 'secret_key',
    resave: false,
    saveUninitialized: false
}));

app.get('/car-details/:id', async (req, res) => {
    const car = await getCarById(req.params.id); // Fetch car details
    const imageUrls = car.imageUrls; // Array of image URLs from DB

    res.render('car-details', {
        car: car,
        imageUrls: imageUrls
    });
});

app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Set `user` globally for all views
    next();
});

// Use Routes
app.use('/payment', paymentRoutes);
app.use('/', indexRoutes);
app.use('/all-cars', rentals);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/booking', bookingRoutes);
app.use('/profile', profileRoutes);
app.use('/user', adminPanelRoutes);
app.use('/favourites', favouritesRoutes)

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

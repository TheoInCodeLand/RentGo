const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chatbot.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            name TEXT,
            surname TEXT,
            email TEXT UNIQUE,
            phone TEXT,
            address TEXT,
            age INTEGER,
            role TEXT CHECK(role IN ('admin', 'customer'))
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS cars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT,
            brand TEXT,
            mileage INTEGER,
            available INTEGER,
            transmission TEXT CHECK(transmission IN ('Automatic', 'Manual')),
            description TEXT,
            upload_date TEXT,
            upload_time TEXT,
            seats INTEGER,
            type TEXT CHECK(type IN ('SUV', 'Sedan', 'Hatchback', 'Coupe', 'Truck')),
            fuel_type TEXT CHECK(fuel_type IN ('Petrol', 'Diesel', 'Electric', 'Hybrid')),
            price_per_day REAL,
            image_url TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER,
            customer_id INTEGER,
            booking_date TEXT,
            return_date TEXT,
            booking_time TEXT,
            return_time TEXT,
            FOREIGN KEY (car_id) REFERENCES cars (id),
            FOREIGN KEY (customer_id) REFERENCES users (id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER,
            user_id INTEGER,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            review_date TEXT,
            FOREIGN KEY (car_id) REFERENCES cars (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    console.log("Database initialized!");
});

db.close();

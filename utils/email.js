require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Email provider
    auth: {
        user: process.env.EMAIL_USER, // Securely loaded from .env
        pass: process.env.EMAIL_PASS, // Securely loaded from .env
    },
});

module.exports = transporter;

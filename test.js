const transporter = require('./utils/email'); // Adjust path to email.js

const mailOptions = {
    from: process.env.EMAIL_USER,
    to: '220330220@ump.ac.za', // Replace with a test recipient
    subject: 'Test Email',
    text: 'This is a test email sent using Nodemailer.',
};

transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
        console.error('Error sending email:', err);
    } else {
        console.log('Email sent:', info.response);
    }
});

const ContactUs = require('../models/ContactUs');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter (using Gmail as example, replace with your SMTP details)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // set in .env
    pass: process.env.MAIL_PASS  // set in .env
  }
});

exports.submitContactUs = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    // Save to DB
    const contact = new ContactUs({ name, email, message });
    await contact.save();

    // Send email
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: 'shrajal@napft.com',
      subject: 'New Contact Us Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    });

    res.status(201).json({ message: 'Contact form submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit contact form.' });
  }
};

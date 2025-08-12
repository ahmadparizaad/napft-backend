const express = require('express');
const router = express.Router();
const { submitContactUs } = require('../controllers/contactUsController');

// POST /contactus
router.post('/contactus', submitContactUs);

module.exports = router;

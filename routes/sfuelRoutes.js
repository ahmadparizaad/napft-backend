const express = require('express');
const router = express.Router();
const { distributeSFuel } = require('../controllers/sfuelController');

// Apply rate limiter to this route
router.post('/distribute-sfuel', distributeSFuel);

module.exports = router;
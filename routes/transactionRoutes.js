
const express = require('express');
const { body } = require('express-validator');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

// Validation middleware
const transactionValidation = [
  body('type').isIn(['mint', 'buy', 'sell', 'transfer', 'list', 'unlist'])
    .withMessage('Invalid transaction type'),
  body('tokenId').notEmpty().withMessage('Token ID is required'),
  body('from').notEmpty().withMessage('From address is required'),
  body('to').notEmpty().withMessage('To address is required')
];

// Get all transactions
router.get('/', transactionController.getAllTransactions);

// Get transactions by user
router.get('/user/:address', transactionController.getTransactionsByUser);

// Get transactions by NFT
router.get('/nft/:id', transactionController.getTransactionsByNFT);

// Create transaction
router.post('/', transactionValidation, transactionController.createTransaction);

// Get recent transactions
router.get('/recent', transactionController.getRecentTransactions);

module.exports = router;

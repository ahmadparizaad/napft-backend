
const express = require('express');
const { body } = require('express-validator');
const collectionController = require('../controllers/collectionController');

const router = express.Router();

// Validation middleware
const collectionValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('creator').notEmpty().withMessage('Creator address is required')
];

// Get all collections
router.get('/', collectionController.getAllCollections);

// Get collection by ID
router.get('/:id', collectionController.getCollectionById);

// Create new collection
router.post('/', collectionValidation, collectionController.createCollection);

// Update collection
router.put('/:id', collectionController.updateCollection);

// Get collections by creator
router.get('/creator/:address', collectionController.getCollectionsByCreator);

// Add NFT to collection
router.post('/add-nft', collectionController.addNFTToCollection);

module.exports = router;

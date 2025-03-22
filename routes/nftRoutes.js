const express = require('express');
const { body } = require('express-validator');
const nftController = require('../controllers/nftController');

const router = express.Router();

// Validation middleware
const nftValidation = [
  body('tokenId').isNumeric().withMessage('Token ID must be a number'),
  body('title').notEmpty().withMessage('Title is required'),
  body('image').notEmpty().withMessage('Image URL is required'),
  body('owner').notEmpty().withMessage('Owner address is required'),
  body('creator').notEmpty().withMessage('Creator address is required'),
  body('ipfsHash').notEmpty().withMessage('IPFS hash is required')
];

// Get all NFTs
router.get('/', nftController.getAllNFTs);

// Get trending NFTs
router.get('/trending', nftController.getTrendingNFTs);

// Get NFT by ID
router.get('/:id', nftController.getNFTById);

// Get NFT by token ID
router.get('/token/:tokenId', nftController.getNFTByTokenId);

// Create new NFT
router.post('/', nftValidation, nftController.createNFT);

// Update NFT
router.put('/:tokenId', nftController.updateNFT);

// Buy NFT
router.post('/buy', nftController.buyNFT);

// Get NFTs by owner
router.get('/owner/:address', nftController.getNFTsByOwner);

// Get NFTs by creator
router.get('/creator/:address', nftController.getNFTsByCreator);

// Get transaction history by token ID
router.get('/transactions/:tokenId', nftController.getTransactionHistoryByTokenId);

module.exports = router;

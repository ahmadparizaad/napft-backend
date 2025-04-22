const NFT = require('../models/NFT');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all NFTs with pagination
exports.getAllNFTs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Handle filtering
    const filter = {};
    
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isListed === 'true') filter.isListed = true;
    if (req.query.isListed === 'false') filter.isListed = false;
    if (req.query.tokenStandard) filter.tokenStandard = req.query.tokenStandard;
    if (req.query.rarity) filter.rarity = req.query.rarity;
    if (req.query.creator) filter.creator = req.query.creator;
    if (req.query.owner) filter.owner = req.query.owner;
    
    // Handle price range
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }
    
    // Handle search
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Handle sorting
    let sort = {};
    switch (req.query.sort) {
      case 'priceAsc':
        sort = { price: 1 };
        break;
      case 'priceDesc':
        sort = { price: -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
    
    const nfts = await NFT.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await NFT.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data: nfts,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting NFTs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFTs',
      error: error.message
    });
  }
};

// Get NFT by ID
exports.getNFTById = async (req, res) => {
  try {
    const nft = await NFT.findById(req.params.id);
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Get transaction history
    const transactions = await Transaction.find({ nftId: nft._id })
      .sort({ timestamp: -1 });
    
    res.status(200).json({
      success: true,
      data: { ...nft.toObject(), transactionHistory: transactions }
    });
  } catch (error) {
    console.error('Error getting NFT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT',
      error: error.message
    });
  }
};

// Get NFT by Token ID
exports.getNFTByTokenId = async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    const nft = await NFT.findOne({ tokenId });
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Get transaction history
    const transactions = await Transaction.find({ tokenId })
      .sort({ timestamp: -1 });
    
    res.status(200).json({
      success: true,
      data: { ...nft.toObject(), transactionHistory: transactions }
    });
  } catch (error) {
    console.error('Error getting NFT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT',
      error: error.message
    });
  }
};

// Create new NFT
exports.createNFT = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }
    
    const {
      tokenId,
      title,
      description,
      price,
      owner,
      creator,
      royaltyFee,
      isListed,
      category,
      rarity,
      tokenStandard,
      attributes,
      ipfsHash,
      collectionId,
      utilityPercent
    } = req.body;
    
    // Check if NFT with this tokenId already exists
    const existingNFT = await NFT.findOne({ tokenId });
    if (existingNFT) {
      return res.status(400).json({
        success: false,
        message: 'NFT with this token ID already exists'
      });
    }
    
    // Create the NFT
    const nft = await NFT.create({
      tokenId,
      title,
      description,
      price,
      currency: 'USDC',
      owner,
      creator,
      royaltyFee,
      isListed,
      category,
      rarity,
      tokenStandard,
      attributes,
      ipfsHash,
      collectionId,
      utilityPercent,
      createdAt: new Date()
    });
    
    // Create mint transaction
    const transaction = await Transaction.create({
      type: 'mint',
      nftId: nft._id,
      tokenId,
      from: '0xC202B26262b4a3110d3Df2617325c41DfB62933e', // Mint address
      to: creator,
      price: 0,
      currency: 'USDC',
      txHash: req.body.txHash || `0x${Math.random().toString(16).slice(2, 66)}`,
      timestamp: new Date()
    });
    
    // Update NFT with transaction
    nft.transactionHistory.push(transaction._id);
    await nft.save();
    
    // Update User (creator and owner are the same when minting)
    let user = await User.findOne({ address: creator });
    
    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        address: creator,
        nftsCreated: [nft._id],
        nftsOwned: [nft._id]
      });
    } else {
      // Update existing user
      user.nftsCreated.push(nft._id);
      user.nftsOwned.push(nft._id);
      await user.save();
    }
    
    res.status(201).json({
      success: true,
      data: nft,
      transaction
    });
  } catch (error) {
    console.error('Error creating NFT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create NFT',
      error: error.message
    });
  }
};

// Update NFT
exports.updateNFT = async (req, res) => {
  try {
    const nft = await NFT.findOne({ tokenId: req.params.tokenId });
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Only allow owner to update
    if (nft.owner.toLowerCase() !== req.body.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this NFT'
      });
    }
    
    // Fields that can be updated
    const allowedUpdates = [
      'title',
      'description',
      'price',
      'isListed',
      'category'
    ];
    
    // Update only allowed fields
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        nft[field] = req.body[field];
      }
    });
    
    // If listing status changed, create a transaction
    if (req.body.isListed !== undefined && req.body.isListed !== nft.isListed) {
      const transactionType = req.body.isListed ? 'list' : 'unlist';
      
      const transaction = await Transaction.create({
        type: transactionType,
        nftId: nft._id,
        tokenId: nft.tokenId,
        from: nft.owner,
        to: nft.owner,
        price: req.body.price || nft.price,
        currency: 'USDC',
        txHash: req.body.txHash || `0x${Math.random().toString(16).slice(2, 66)}`,
        timestamp: new Date()
      });
      
      nft.transactionHistory.push(transaction._id);
    }
    
    await nft.save();
    
    res.status(200).json({
      success: true,
      data: nft
    });
  } catch (error) {
    console.error('Error updating NFT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NFT',
      error: error.message
    });
  }
};

// Buy NFT
exports.buyNFT = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { tokenId, buyer, txHash } = req.body;
    
    const nft = await NFT.findOne({ tokenId }).session(session);
    
    if (!nft) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    if (!nft.isListed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'NFT is not listed for sale'
      });
    }
    
    // Prevent buying your own NFT
    if (nft.owner.toLowerCase() === buyer.toLowerCase()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You cannot buy your own NFT'
      });
    }
    
    const oldOwner = nft.owner;
    
    // Create buy transaction
    const transaction = await Transaction.create([{
      type: 'buy',
      nftId: nft._id,
      tokenId: nft.tokenId,
      from: oldOwner,
      to: buyer,
      price: nft.price,
      currency: 'USDC',
      txHash: txHash || `0x${Math.random().toString(16).slice(2, 66)}`,
      timestamp: new Date()
    }], { session });
    
    // Update NFT
    nft.owner = buyer;
    nft.isListed = false;
    nft.transactionHistory.push(transaction[0]._id);
    await nft.save({ session });
    
    // Update old owner
    const oldOwnerUser = await User.findOne({ address: oldOwner }).session(session);
    if (oldOwnerUser) {
      oldOwnerUser.nftsOwned = oldOwnerUser.nftsOwned.filter(
        id => id.toString() !== nft._id.toString()
      );
      oldOwnerUser.totalVolume += nft.price;
      await oldOwnerUser.save({ session });
    }
    
    // Update buyer
    let buyerUser = await User.findOne({ address: buyer }).session(session);
    if (!buyerUser) {
      buyerUser = await User.create([{
        address: buyer,
        nftsOwned: [nft._id]
      }], { session });
    } else {
      if (!buyerUser.nftsOwned.includes(nft._id)) {
        buyerUser.nftsOwned.push(nft._id);
      }
      await buyerUser.save({ session });
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      data: {
        nft,
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error buying NFT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to buy NFT',
      error: error.message
    });
  }
};

// Get NFTs by owner
exports.getNFTsByOwner = async (req, res) => {
  try {
    const { address } = req.params;
    console.log('Finding NFTs for owner address:', address);
    
    // Use case-insensitive regex to match owner address
    const nfts = await NFT.find({ 
      owner: { $regex: new RegExp(`^${address}$`, 'i') } 
    });
    
    console.log(`Found ${nfts.length} NFTs for owner ${address}`);
    
    res.status(200).json({
      success: true,
      data: nfts
    });
  } catch (error) {
    console.error('Error getting NFTs by owner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFTs',
      error: error.message
    });
  }
};

// Get NFTs by creator
exports.getNFTsByCreator = async (req, res) => {
  try {
    const { address } = req.params;
    console.log('Finding NFTs for creator address:', address);
    
    // Use case-insensitive regex to match creator address
    const nfts = await NFT.find({ 
      creator: { $regex: new RegExp(`^${address}$`, 'i') } 
    });
    
    console.log(`Found ${nfts.length} NFTs for creator ${address}`);
    
    res.status(200).json({
      success: true,
      data: nfts
    });
  } catch (error) {
    console.error('Error getting NFTs by creator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFTs',
      error: error.message
    });
  }
};

// Get transaction history by token ID
exports.getTransactionHistoryByTokenId = async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    const nft = await NFT.findOne({ tokenId });
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    const transactions = await Transaction.find({ nftId: nft._id })
      .sort({ timestamp: -1 });
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: error.message
    });
  }
};

// Get trending NFTs based on transaction activity and views
exports.getTrendingNFTs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    
    console.log(`Finding trending NFTs, limit: ${limit}`);
    
    // Get NFTs with recent transactions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Find NFTs with recent transactions
    const recentTransactions = await Transaction.find({
      timestamp: { $gte: sevenDaysAgo }
    })
    .sort({ timestamp: -1 })
    .populate('nftId');
    
    // Extract unique NFT IDs from transactions
    const nftIdsFromTransactions = [...new Set(
      recentTransactions
        .map(tx => tx.nftId?._id?.toString())
        .filter(id => id) // Filter out nulls
    )];
    
    // Get those NFTs but only include ones that are listed
    let trendingNFTs = [];
    
    if (nftIdsFromTransactions.length > 0) {
      trendingNFTs = await NFT.find({
        _id: { $in: nftIdsFromTransactions },
        isListed: true // Only get listed NFTs
      }).limit(limit);
    }
    
    // If we don't have enough trending NFTs from transactions, get the most recently created ones that are listed
    if (trendingNFTs.length < limit) {
      const additionalNFTs = await NFT.find({
        _id: { $nin: trendingNFTs.map(nft => nft._id) }, // Exclude NFTs we already have
        isListed: true // Only get listed NFTs
      })
      .sort({ createdAt: -1 })
      .limit(limit - trendingNFTs.length);
      
      trendingNFTs = [...trendingNFTs, ...additionalNFTs];
    }
    
    console.log(`Found ${trendingNFTs.length} trending listed NFTs`);
    
    res.status(200).json({
      success: true,
      data: trendingNFTs
    });
  } catch (error) {
    console.error('Error getting trending NFTs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending NFTs',
      error: error.message
    });
  }
};

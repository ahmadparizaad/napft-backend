
const Transaction = require('../models/Transaction');
const NFT = require('../models/NFT');
const User = require('../models/User');

// Get all transactions with pagination
exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Handle filtering
    const filter = {};
    
    if (req.query.type) filter.type = req.query.type;
    if (req.query.from) filter.from = req.query.from;
    if (req.query.to) filter.to = req.query.to;
    
    // Handle time filtering
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    const transactions = await Transaction.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('nftId', 'title image tokenId');
    
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

// Get transactions by user address (as buyer or seller)
exports.getTransactionsByUser = async (req, res) => {
  try {
    const { address } = req.params;
    
    const transactions = await Transaction.find({
      $or: [{ from: address }, { to: address }]
    })
      .sort({ timestamp: -1 })
      .populate('nftId', 'title image tokenId');
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting user transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

// Get transactions by NFT ID
exports.getTransactionsByNFT = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transactions = await Transaction.find({ nftId: id })
      .sort({ timestamp: -1 });
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting NFT transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

// Create a transaction record
exports.createTransaction = async (req, res) => {
  try {
    const {
      type,
      tokenId,
      from,
      to,
      price,
      currency,
      txHash
    } = req.body;
    
    // Find the NFT by tokenId
    const nft = await NFT.findOne({ tokenId: parseInt(tokenId) });
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Create transaction
    const transaction = await Transaction.create({
      type,
      nftId: nft._id,
      tokenId: parseInt(tokenId),
      from,
      to,
      price: price || 0,
      currency: currency || 'USDC',
      txHash: txHash || `0x${Math.random().toString(16).slice(2, 66)}`,
      timestamp: new Date()
    });
    
    // Update NFT's transaction history
    nft.transactionHistory.push(transaction._id);
    
    // If it's a buy/sell transaction, update NFT ownership
    if (type === 'buy' || type === 'sell') {
      nft.owner = to;
      nft.isListed = false;
      
      // Update user records
      const seller = await User.findOne({ address: from });
      if (seller) {
        seller.nftsOwned = seller.nftsOwned.filter(
          id => id.toString() !== nft._id.toString()
        );
        seller.totalVolume += price;
        await seller.save();
      }
      
      let buyer = await User.findOne({ address: to });
      if (!buyer) {
        buyer = await User.create({
          address: to,
          nftsOwned: [nft._id]
        });
      } else {
        buyer.nftsOwned.push(nft._id);
        await buyer.save();
      }
    }
    
    // If it's a list/unlist transaction, update NFT listing status
    if (type === 'list') {
      nft.isListed = true;
      nft.price = price;
    } else if (type === 'unlist') {
      nft.isListed = false;
    }
    
    await nft.save();
    
    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
};

// Get recent transactions
exports.getRecentTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const transactions = await Transaction.find({
      type: { $in: ['buy', 'sell', 'mint'] }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('nftId', 'title image tokenId price');
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

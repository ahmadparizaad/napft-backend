
const Collection = require('../models/Collection');
const NFT = require('../models/NFT');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all collections
exports.getAllCollections = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Handle filtering
    const filter = {};
    
    if (req.query.category) filter.category = req.query.category;
    if (req.query.creator) filter.creator = req.query.creator;
    
    // Handle search
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    
    // Handle sorting
    let sort = {};
    switch (req.query.sort) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'volumeDesc':
        sort = { totalVolume: -1 };
        break;
      case 'floorDesc':
        sort = { floorPrice: -1 };
        break;
      case 'floorAsc':
        sort = { floorPrice: 1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
    
    const collections = await Collection.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Collection.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data: collections,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message
    });
  }
};

// Get collection by ID
exports.getCollectionById = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }
    
    // Get NFTs in this collection
    const nfts = await NFT.find({ collectionId: collection._id });
    
    res.status(200).json({
      success: true,
      data: {
        ...collection.toObject(),
        nfts
      }
    });
  } catch (error) {
    console.error('Error getting collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection',
      error: error.message
    });
  }
};

// Create new collection
exports.createCollection = async (req, res) => {
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
      name,
      description,
      image,
      bannerImage,
      creator,
      category,
      royaltyFee
    } = req.body;
    
    // Create the collection
    const collection = await Collection.create({
      name,
      description,
      image,
      bannerImage,
      creator,
      category,
      royaltyFee: royaltyFee || 0,
      nfts: [],
      floorPrice: 0,
      totalVolume: 0,
      isVerified: false
    });
    
    // Update user's collections
    const user = await User.findOne({ address: creator });
    
    if (user) {
      user.collectionsCreated.push(collection._id);
      await user.save();
    } else {
      // Create user if it doesn't exist
      await User.create({
        address: creator,
        collectionsCreated: [collection._id]
      });
    }
    
    res.status(201).json({
      success: true,
      data: collection
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create collection',
      error: error.message
    });
  }
};

// Update collection
exports.updateCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }
    
    // Only allow creator to update
    if (collection.creator.toLowerCase() !== req.body.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this collection'
      });
    }
    
    // Fields that can be updated
    const allowedUpdates = [
      'name',
      'description',
      'image',
      'bannerImage',
      'category',
      'royaltyFee'
    ];
    
    // Update only allowed fields
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        collection[field] = req.body[field];
      }
    });
    
    await collection.save();
    
    res.status(200).json({
      success: true,
      data: collection
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update collection',
      error: error.message
    });
  }
};

// Get collections by creator
exports.getCollectionsByCreator = async (req, res) => {
  try {
    const { address } = req.params;
    const collections = await Collection.find({ creator: address });
    
    res.status(200).json({
      success: true,
      data: collections
    });
  } catch (error) {
    console.error('Error getting collections by creator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: error.message
    });
  }
};

// Add NFT to collection
exports.addNFTToCollection = async (req, res) => {
  try {
    const { collectionId, nftId } = req.body;
    
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }
    
    const nft = await NFT.findById(nftId);
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Only allow NFT owner or creator to add to collection
    if (nft.creator.toLowerCase() !== req.body.address.toLowerCase() &&
        nft.owner.toLowerCase() !== req.body.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add this NFT to collection'
      });
    }
    
    // Check if NFT is already in this collection
    if (collection.nfts.includes(nftId)) {
      return res.status(400).json({
        success: false,
        message: 'NFT is already in this collection'
      });
    }
    
    // Add NFT to collection
    collection.nfts.push(nftId);
    await collection.save();
    
    // Update NFT's collection
    nft.collectionId = collectionId;
    await nft.save();
    
    // Update collection floor price
    const nftsInCollection = await NFT.find({ 
      collectionId, 
      isListed: true 
    }).sort({ price: 1 });
    
    if (nftsInCollection.length > 0) {
      collection.floorPrice = nftsInCollection[0].price;
      await collection.save();
    }
    
    res.status(200).json({
      success: true,
      data: {
        collection,
        nft
      }
    });
  } catch (error) {
    console.error('Error adding NFT to collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add NFT to collection',
      error: error.message
    });
  }
};

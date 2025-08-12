const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema({
  trait_type: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
});

const nftSchema = new mongoose.Schema(
  {
    tokenId: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    // We're removing redundant image and metadataURI fields and using only ipfsHash
    // The ipfsHash will be used to generate both image URLs and metadata URIs
    ipfsHash: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      enum: ['ETH', 'USDC', 'SKALE', 'SKL', 'POL', 'MATIC'],
      default: 'ETH'
    },
    owner: {
      type: String,
      required: true
    },
    creator: {
      type: String,
      required: true
    },
    royaltyFee: {
      type: Number,
      default: 0
    },
    isListed: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      enum: ['Art', 'Collectible', 'Photography', 'Music', 'Video', 'Other'],
      default: 'Art'
    },
    rarity: {
      type: String,
      enum: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
      default: 'Common'
    },
    tokenStandard: {
      type: String,
      enum: ['ERC-721', 'ERC-1155'],
      default: 'ERC-721'
    },
    attributes: [attributeSchema],
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      default: null
    },
    // Changed from utilityPercent to both utilityPercent and utilityAmount
    utilityPercent: {
      type: Number,
      default: 0
    },
    utilityAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: v => v ? parseFloat(v.toString()) : 0
    },
    transactionHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      }
    ],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
  }
);

// Create a compound index for tokenId to ensure uniqueness
nftSchema.index({ tokenId: 1 }, { unique: true });

// Virtual property to calculate image URL from ipfsHash
nftSchema.virtual('image').get(function() {
  return `https://ipfs.io/ipfs/${this.ipfsHash}`;
});

// Virtual property to calculate metadataURI from ipfsHash
nftSchema.virtual('metadataURI').get(function() {
  return `https://ipfs.io/ipfs/${this.ipfsHash}`;
});

// Ensure virtuals are included when converting to JSON
nftSchema.set('toJSON', { virtuals: true });
nftSchema.set('toObject', { virtuals: true });

const NFT = mongoose.model('NFT', nftSchema);

module.exports = NFT;


const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    image: {
      type: String
    },
    bannerImage: {
      type: String
    },
    creator: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['Art', 'Collectible', 'Photography', 'Music', 'Video', 'Other'],
      default: 'Art'
    },
    nfts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NFT'
      }
    ],
    floorPrice: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Number,
      default: 0
    },
    royaltyFee: {
      type: Number,
      default: 0
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Collection = mongoose.model('Collection', collectionSchema);

module.exports = Collection;

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    username: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      trim: true
    },
    profileImage: {
      type: String
    },
    coverImage: {
      type: String
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    socials: {
      twitter: String,
      instagram: String,
      website: String
    },
    nftsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NFT'
      }
    ],
    nftsOwned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NFT'
      }
    ],
    collectionsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection'
      }
    ],
    followers: [
      {
        type: String  // Store wallet addresses
      }
    ],
    following: [
      {
        type: String  // Store wallet addresses
      }
    ],
    followersCount: {
      type: Number,
      default: 0
    },
    followingCount: {
      type: Number,
      default: 0
    },
    totalVolume: {
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

const User = mongoose.model('User', userSchema);

module.exports = User;

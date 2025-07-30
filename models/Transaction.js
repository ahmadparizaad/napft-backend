
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['mint', 'buy', 'sell', 'transfer', 'list', 'unlist'],
      required: true
    },
    nftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NFT',
      required: true
    },
    tokenId: {
      type: Number,
      required: true
    },
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      enum: ['ETH', 'USDC', 'SKALE', 'SKL', 'POL', 'MATIC'],
      default: 'ETH'
    },
    txHash: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;

# NFT Marketplace Backend

This is the backend server for the Minimalist NFT Hub marketplace. It provides the API endpoints for the frontend application.

## Setup

1. Install dependencies:
```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Then update the variables with your actual credentials, including:
- `MONGODB_URI`: Your MongoDB connection string
- `SKALE_RPC_URL`: Your SKALE network RPC URL
- `CONTRACT_ADDRESS`: Your NFT contract address (0xC202B26262b4a3110d3Df2617325c41DfB62933e)
- `PINATA_JWT`, `PINATA_API_KEY`, `PINATA_API_SECRET`: Your Pinata credentials
- `GATEWAY_URL`: Your Pinata gateway URL (purple-traditional-earthworm-576.mypinata.cloud)

3. Test your configuration:
```bash
npm run test-config
```
This will verify that your environment variables are correctly set up and test the connection to Pinata if credentials are provided.

4. Test your contract connection:
```bash
npm run test-contract
```
This will test the connection to your NFT contract and verify that all required functions are available, including:
- `GetCurrentToken()` - Gets the current token ID count
- `ownerOf(tokenId)` - Gets the current owner of a token
- `tokenURI(tokenId)` - Gets the token URI (IPFS hash)
- `GetCreatorOfNft(tokenId)` - Gets the creator of an NFT
- `GetNftPrice(tokenId)` - Gets the price of an NFT
- `getRoyaltyFee(tokenId)` - Gets the royalty fee for an NFT
- `getNFTDetails(tokenId)` - Gets comprehensive details about an NFT

5. Start the server:
```bash
npm start
```

For development with auto-reloading:
```bash
   npm run dev
   ```

## NFT Contract Integration

This backend integrates with the NapFT smart contract which implements the following key functions:

- `GetCurrentToken()` - Returns the total number of NFTs minted
- `getNFTDetails(tokenId)` - Returns comprehensive information about an NFT
- `GetCreatorOfNft(tokenId)` - Returns the creator address for a specific NFT
- `GetNftPrice(tokenId)` - Returns the price of an NFT
- `getRoyaltyFee(tokenId)` - Returns the royalty fee percentage for an NFT
- `UpdateNftPrice(tokenId, price)` - Updates the price of an NFT
- `tokenURI(tokenId)` - Returns the IPFS URI for the NFT metadata

The backend scripts use these functions to fetch NFT data from the blockchain and store it in the MongoDB database.

## Data Import Scripts

### Importing NFTs from Your Contract

To import NFTs from your contract and fetch their metadata from IPFS:

```bash
npm run import-contract
```

This script will:
1. Connect to the SKALE blockchain
2. Connect to your NapFT contract
3. Get the total number of NFTs minted using `GetCurrentToken()`
4. For each token ID, fetch comprehensive data using `getNFTDetails()`
5. Retrieve the metadata from IPFS
6. Store the data in the MongoDB database
7. Create appropriate user records and transaction history

### Importing Specific NFTs

To update specific NFTs by their token IDs:

```bash
npm run fetch-nfts
```

This script scans token IDs 1-5 by default. You can modify the `tokensToProcess` array in `backend/scripts/fetchAndUpdateNFTs.js` to customize which NFTs to import.

## Troubleshooting

If you encounter issues with the import process:

### 1. Contract Connection Issues

Run the test contract script to diagnose problems:

```bash
npm run test-contract
```

This will check each contract function and show detailed information about which ones are working.

Common issues:
- Invalid contract address
- Wrong RPC URL
- Contract doesn't implement all expected functions
- Network connectivity problems

For example, if `GetCurrentToken()` fails but `ownerOf()` works, the script will still function by scanning a range of token IDs.

### 2. IPFS Issues

If IPFS metadata or image fetching fails:

- Check your Pinata credentials in the `.env` file
- Test your Pinata connection with `npm run test-config`
- The scripts have fallback mechanisms to try multiple IPFS gateways

### 3. Database Issues

If database operations fail:

- Verify your MongoDB connection string in the `.env` file
- Ensure your MongoDB instance is running
- Check that you have proper permissions for the database

## API Endpoints

### NFTs

- `GET /api/nfts` - Get all NFTs
- `GET /api/nfts/:id` - Get NFT by ID
- `GET /api/nfts/token/:tokenId` - Get NFT by token ID
- `POST /api/nfts` - Create a new NFT
- `PUT /api/nfts/:tokenId` - Update an NFT
- `POST /api/nfts/buy` - Buy an NFT
- `GET /api/nfts/owner/:address` - Get NFTs by owner
- `GET /api/nfts/creator/:address` - Get NFTs by creator
- `GET /api/nfts/transactions/:tokenId` - Get transactions for an NFT

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:address` - Get user by address
- `PUT /api/users/:address` - Update user
- `GET /api/users/stats/:address` - Get user stats

### Transactions

- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create a transaction
- `GET /api/transactions/user/:address` - Get transactions by user
- `GET /api/transactions/nft/:nftId` - Get transactions by NFT
- `GET /api/transactions/recent` - Get recent transactions

## Data Models

### NFT

```javascript
{
  tokenId: Number,
  title: String,
  description: String,
  image: String,
  price: Number,
  currency: String,
  creator: String, // Ethereum address
  owner: String, // Ethereum address
  royaltyFee: Number, // As a decimal (e.g., 0.05 for 5%)
  isListed: Boolean,
  category: String,
  rarity: String,
  tokenStandard: String,
  attributes: Array,
  ipfsHash: String,
  metadataURI: String,
  transactionHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  createdAt: Date,
  updatedAt: Date
}
```

### User

```javascript
{
  address: String, // Ethereum address
  username: String,
  bio: String,
  profileImage: String,
  coverImage: String,
  isVerified: Boolean,
  nftsOwned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NFT' }],
  nftsCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NFT' }],
  followers: Number,
  following: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction

```javascript
{
  type: String, // 'mint', 'buy', 'sell', 'transfer', 'list', 'unlist'
  nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT' },
  tokenId: Number,
  from: String, // Ethereum address
  to: String, // Ethereum address
  price: Number,
  currency: String,
  txHash: String,
  timestamp: Date
}
```


# NFT Import Scripts

This directory contains utility scripts for importing NFT data into the MongoDB database.

## importNFTsFromIPFS.js

This script imports NFT metadata from IPFS into the MongoDB database.

### Usage:

1. First, edit the script to add your IPFS hashes in the `ipfsHashes` array:

```js
const ipfsHashes = [
  'QmXExS4BMc1YrH6iWERyryFJHfFpZkJw9g2TgXSz9BZAhB',
  'QmYtXKiYueo6XMTvPguLnP5j1nsZUNWvnYyJ9UhRExeW6K',
  // Add your IPFS hashes here
];
```

2. Make sure your MongoDB connection string is set in the `.env` file:

```
MONGODB_URI=mongodb+srv://username:password@cluster-name.mongodb.net/nft-marketplace?retryWrites=true&w=majority
```

3. Run the script:

```bash
node scripts/importNFTsFromIPFS.js
```

4. The script will:
   - Fetch metadata from IPFS for each hash
   - Create NFT records in the database
   - Create mint transaction records
   - Update or create user records for creators/owners
   - Skip any NFTs that already exist in the database

### Manually Running IPFS Imports:

If you need to import a specific NFT, you can:

1. Add its IPFS hash to the `ipfsHashes` array
2. Run the script again

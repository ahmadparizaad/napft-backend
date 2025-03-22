require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const { ethers } = require("ethers");

// Import models
const NFT = require("../models/NFT");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// Import contract config from our CommonJS file
const { contractAddress, abi } = require("./contractConfig");

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return false;
  }
}

// Fetch metadata from IPFS using the provided gateway
async function fetchMetadataFromIPFS(ipfsHash) {
  try {
    // Clean the hash (remove ipfs:// prefix if exists)
    const cleanHash = ipfsHash.replace('ipfs://', '');
    
    // Auth options for Pinata
    const options = process.env.PINATA_JWT ? {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    } : {};

    // Get gateway URL from environment variable
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";

    // Try custom Pinata gateway first
    try {
      const customGateway = `https://${gatewayUrl}/ipfs/${cleanHash}`;
      const response = await axios.get(customGateway, options);
      console.log(`Fetched from custom Pinata gateway: ${cleanHash}`);
      return response.data;
    } catch (customGatewayError) {
      console.log(`Failed to fetch from custom Pinata gateway: ${customGatewayError.message}`);
      
      // Try Pinata's default gateway
      try {
        const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cleanHash}`;
        const response = await axios.get(pinataUrl, options);
        console.log(`Fetched from Pinata gateway: ${cleanHash}`);
        return response.data;
      } catch (pinataError) {
        console.log(`Failed to fetch from Pinata gateway: ${pinataError.message}`);
        
        // Fallback to public gateway
        const publicUrl = `https://ipfs.io/ipfs/${cleanHash}`;
        const publicResponse = await axios.get(publicUrl);
        console.log(`Fetched from public gateway: ${cleanHash}`);
        return publicResponse.data;
      }
    }
  } catch (error) {
    console.error(`Error fetching metadata for hash ${ipfsHash}:`, 
      error.response ? error.response.data : error.message);
    return null;
  }
}

// Fetch image from IPFS with multiple gateway fallbacks
async function fetchImageFromIPFS(imageIpfsHash) {
  try {
    // Clean the hash (remove ipfs:// prefix if exists)
    const cleanHash = imageIpfsHash.replace('ipfs://', '');
    
    // Get gateway from env or use default
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";
    
    // Try different IPFS gateways including the custom one
    const gateways = [
      `https://${gatewayUrl}/ipfs/`,
      "https://gateway.pinata.cloud/ipfs/",
      "https://ipfs.io/ipfs/",
      "https://cloudflare-ipfs.com/ipfs/"
    ];
    
    for (const gateway of gateways) {
      try {
        const url = `${gateway}${cleanHash}`;
        // Just check if the URL is accessible
        await axios.head(url, { timeout: 5000 });
        return url;
      } catch (error) {
        console.log(`Failed to fetch from gateway ${gateway}: ${error.message}`);
        continue;
      }
    }
    
    // If all gateways fail, return the original hash with the custom gateway
    return `https://${gatewayUrl}/ipfs/${cleanHash}`;
  } catch (error) {
    console.error(`Error processing image hash ${imageIpfsHash}:`, error.message);
    return null;
  }
}

// Process NFT metadata and store in database
async function processNFTMetadata(tokenId, metadataURI, creator, owner, price, royaltyFee) {
  try {
    // Check if NFT already exists
    const existingNFT = await NFT.findOne({ tokenId });
    
    if (existingNFT) {
      console.log(`NFT with token ID ${tokenId} already exists. Checking for updates...`);
      
      // Update owner if it has changed
      if (existingNFT.owner.toLowerCase() !== owner.toLowerCase()) {
        console.log(`Updating owner of token ID ${tokenId} from ${existingNFT.owner} to ${owner}`);
        existingNFT.owner = owner;
        
        // Update price if available
        if (price) {
          console.log(`Updating price of token ID ${tokenId} to ${price}`);
          existingNFT.price = ethers.utils.formatUnits(price, 'ether');
        }
        
        await existingNFT.save();
        
        // Create transfer transaction
        const transaction = new Transaction({
          type: 'transfer',
          nftId: existingNFT._id,
          tokenId: existingNFT.tokenId,
          from: existingNFT.owner,
          to: owner,
          price: 0, // Transfers don't involve a price
          currency: 'USDC',
          txHash: `0x${Math.random().toString(16).slice(2, 66)}`, // Mock tx hash
          timestamp: new Date()
        });
        
        await transaction.save();
        console.log(`Created transfer transaction for token ID ${tokenId}`);
        
        // Update user collections
        await User.findOneAndUpdate(
          { address: existingNFT.owner.toLowerCase() },
          { $pull: { nftsOwned: existingNFT._id } }
        );
        
        await User.findOneAndUpdate(
          { address: owner.toLowerCase() },
          { 
            $addToSet: { nftsOwned: existingNFT._id },
            $setOnInsert: { 
              username: `User_${owner.substring(2, 8)}`,
              bio: `NFT Collector with address ${owner.substring(0, 10)}...`,
              profileImage: `https://source.unsplash.com/random/300x300?profile&sig=${Math.floor(Math.random() * 1000)}`,
              coverImage: `https://source.unsplash.com/random/1200x400?abstract&sig=${Math.floor(Math.random() * 1000)}`,
              isVerified: false
            } 
          },
          { upsert: true, new: true }
        );
      }
      
      return existingNFT;
    }
    
    // Extract IPFS hash from metadata URI
    let ipfsHash = metadataURI;
    if (metadataURI.startsWith('ipfs://')) {
      ipfsHash = metadataURI.replace('ipfs://', '');
    }
    
    // Fetch metadata from IPFS
    const metadata = await fetchMetadataFromIPFS(ipfsHash);
    
    if (!metadata) {
      console.error(`Could not fetch metadata for token ID ${tokenId}`);
      return null;
    }
    
    console.log(`Processing metadata for token ID ${tokenId}:`, metadata.name || `NFT #${tokenId}`);
    
    // Process image URL (might be IPFS hash)
    let imageUrl = metadata.image;
    if (imageUrl && imageUrl.includes('ipfs://')) {
      imageUrl = await fetchImageFromIPFS(imageUrl);
    }
    
    // If no image URL is available, use a default placeholder
    if (!imageUrl) {
      console.log(`No image URL found for token ID ${tokenId}, using placeholder`);
      imageUrl = `https://source.unsplash.com/random/800x800?nft&sig=${tokenId}`;
    }
    
    // Format price from wei to ether if it's a big number
    let formattedPrice = price;
    if (typeof price === 'object' && price._isBigNumber) {
      formattedPrice = ethers.utils.formatUnits(price, 'ether');
    }
    
    // Create NFT record
    const nft = new NFT({
      tokenId,
      title: metadata.name || `NFT #${tokenId}`,
      description: metadata.description || "",
      image: imageUrl,
      price: formattedPrice || 100, // Use provided price or default
      currency: "USDC",
      creator: creator,
      owner: owner,
      royaltyFee: royaltyFee || metadata.royaltyFee || 0.05, // Use provided royalty or default
      isListed: true, // Listed by default since it's on the contract
      category: metadata.category || "Art",
      rarity: metadata.rarity || "Common",
      tokenStandard: "ERC-721",
      attributes: metadata.attributes || [],
      ipfsHash,
      metadataURI,
      createdAt: new Date()
    });
    
    // Save NFT to database
    await nft.save();
    console.log(`Saved NFT with token ID ${tokenId} to database`);
    
    // Create mint transaction
    const transaction = new Transaction({
      type: 'mint',
      nftId: nft._id,
      tokenId: nft.tokenId,
      from: '0x0000000000000000000000000000000000000000', // Zero address
      to: nft.creator,
      price: 0,
      currency: 'USDC',
      txHash: `0x${Math.random().toString(16).slice(2, 66)}`, // Mock tx hash
      timestamp: nft.createdAt
    });
    
    await transaction.save();
    console.log(`Created mint transaction for token ID ${tokenId}`);
    
    // Ensure user records exist and are updated
    await User.findOneAndUpdate(
      { address: nft.creator.toLowerCase() },
      { 
        $addToSet: { nftsCreated: nft._id },
        $setOnInsert: { 
          username: `User_${nft.creator.substring(2, 8)}`,
          bio: `NFT Creator with address ${nft.creator.substring(0, 10)}...`,
          profileImage: `https://source.unsplash.com/random/300x300?profile&sig=${Math.floor(Math.random() * 1000)}`,
          coverImage: `https://source.unsplash.com/random/1200x400?abstract&sig=${Math.floor(Math.random() * 1000)}`,
          isVerified: false
        } 
      },
      { upsert: true, new: true }
    );
    
    if (nft.owner.toLowerCase() !== nft.creator.toLowerCase()) {
      await User.findOneAndUpdate(
        { address: nft.owner.toLowerCase() },
        { 
          $addToSet: { nftsOwned: nft._id },
          $setOnInsert: { 
            username: `User_${nft.owner.substring(2, 8)}`,
            bio: `NFT Collector with address ${nft.owner.substring(0, 10)}...`,
            profileImage: `https://source.unsplash.com/random/300x300?profile&sig=${Math.floor(Math.random() * 1000) + 500}`,
            coverImage: `https://source.unsplash.com/random/1200x400?abstract&sig=${Math.floor(Math.random() * 1000) + 500}`,
            isVerified: false
          } 
        },
        { upsert: true, new: true }
      );
    } else {
      await User.findOneAndUpdate(
        { address: nft.owner.toLowerCase() },
        { $addToSet: { nftsOwned: nft._id } }
      );
    }
    
    console.log(`Updated user records for token ID ${tokenId}`);
    return nft;
    
  } catch (error) {
    console.error(`Error processing NFT with token ID ${tokenId}:`, error);
    return null;
  }
}

// Main function to import NFTs from contract
async function importNFTsFromContract() {
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to database. Exiting.");
    return;
  }
  
  try {
    console.log("Starting to import NFTs from contract...");
    
    // Get contract address from environment variable first, then from our config file
    const contractAddr = process.env.CONTRACT_ADDRESS || contractAddress;
    console.log(`Using contract address: ${contractAddr}`);
    
    // Connect to SKALE Network
    const SKALE_RPC_URL = process.env.SKALE_RPC_URL || "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
    const provider = new ethers.providers.JsonRpcProvider(SKALE_RPC_URL);
    console.log("Connected to SKALE network");
    
    // Initialize contract
    const nftContract = new ethers.Contract(contractAddr, abi, provider);
    console.log("Initialized NFT contract");
    
    // Try to get total supply using GetCurrentToken first
    let totalSupply;
    let maxTokenId = 100; // Default maximum to try
    
    try {
      totalSupply = await nftContract.GetCurrentToken();
      console.log(`Total NFTs minted: ${totalSupply.toString()}`);
      maxTokenId = totalSupply.toNumber();
    } catch (error) {
      console.warn("Could not get GetCurrentToken from contract. Will try scanning token IDs instead.");
      console.warn("Error details:", error.message);
    }
    
    const results = [];
    // Process each token ID sequentially
    for (let i = 1; i <= maxTokenId; i++) {
      try {
        console.log(`Processing token ID ${i}...`);
        
        // Check if token exists by calling ownerOf (this will throw if token doesn't exist)
        let owner;
        try {
          owner = await nftContract.ownerOf(i);
          console.log(`Owner of token ID ${i}: ${owner}`);
        } catch (error) {
          console.log(`Token ID ${i} doesn't exist or was burned, skipping.`);
          continue;
        }
        
        // Try to get comprehensive NFT details first
        let creator, price, royaltyFee, tokenURI, paymentToken;
        
        try {
          // Get complete NFT details from the contract
          const nftDetails = await nftContract.getNFTDetails(i);
          creator = nftDetails.creator;
          owner = nftDetails.owner; // Update with the current owner from getNFTDetails
          price = nftDetails.price;
          tokenURI = nftDetails.ipfsHash;
          royaltyFee = nftDetails.royaltyFee / 100; // Convert from percentage to decimal
          console.log(`Got NFT details for token ID ${i}:`, {
            creator,
            owner,
            price: price.toString(),
            tokenURI,
            royaltyFee
          });
        } catch (error) {
          console.log(`Could not get comprehensive NFT details for token ID ${i}, trying individual calls:`, error.message);
          
          // Try to get token URI with error handling
          try {
            tokenURI = await nftContract.tokenURI(i);
            console.log(`Token URI for ID ${i}: ${tokenURI}`);
          } catch (error) {
            console.error(`Error fetching tokenURI for token ID ${i}: ${error.message}`);
            console.log(`Skipping token ID ${i} due to missing tokenURI`);
            continue;
          }
          
          // Skip if tokenURI is empty or invalid
          if (!tokenURI || tokenURI === '') {
            console.log(`Token ID ${i} has empty tokenURI, skipping.`);
            continue;
          }
          
          // Try to get creator (first transaction history address)
          try {
            creator = await nftContract.GetCreatorOfNft(i);
            console.log(`Creator of token ID ${i}: ${creator}`);
          } catch (error) {
            console.log(`Could not get creator for token ID ${i}, using owner:`, error.message);
            creator = owner;
          }
          
          // Try to get royalty fee
          try {
            const royaltyBasisPoints = await nftContract.getRoyaltyFee(i);
            royaltyFee = royaltyBasisPoints / 100; // Convert from percentage to decimal
            console.log(`Royalty fee for token ID ${i}: ${royaltyFee}`);
          } catch (error) {
            console.log(`Could not get royalty fee for token ID ${i}, using default:`, error.message);
            royaltyFee = 0.05; // Default 5%
          }
          
          // Try to get price
          try {
            price = await nftContract.GetNftPrice(i);
            console.log(`Price for token ID ${i}: ${price.toString()}`);
          } catch (error) {
            console.log(`Could not get price for token ID ${i}, using default:`, error.message);
            price = ethers.utils.parseEther("0.1"); // Default price
          }
        }
        
        // Process the NFT metadata
        const result = await processNFTMetadata(
          i, 
          tokenURI, 
          creator, 
          owner, 
          price, 
          royaltyFee
        );
        
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error processing token ID ${i}:`, error);
      }
    }
    
    console.log(`Successfully processed ${results.length} NFTs.`);
    
  } catch (error) {
    console.error("Error in importNFTsFromContract:", error);
  } finally {
    // Close database connection
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the import function
importNFTsFromContract(); 
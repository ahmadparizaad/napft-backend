require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
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

// Fetch metadata from IPFS via Pinata
async function fetchMetadataFromIPFS(ipfsHash) {
  try {
    // Option 1: Using Pinata API with authentication
    const options = process.env.PINATA_JWT ? {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    } : {};

    // Get gateway URL from environment variable
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";

    // Try custom Pinata gateway first
    try {
      // Use the provided custom gateway
      const customGateway = `https://${gatewayUrl}/ipfs/${ipfsHash}`;
      const response = await axios.get(customGateway, options);
      console.log(`Fetched from custom Pinata gateway: ${ipfsHash}`);
      return response.data;
    } catch (customGatewayError) {
      console.log(`Failed to fetch from custom Pinata gateway: ${customGatewayError.message}`);
      
      // Try Pinata's default gateway  
      try {
        const pinataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        const response = await axios.get(pinataUrl, options);
        console.log(`Fetched from Pinata gateway: ${ipfsHash}`);
        return response.data;
      } catch (pinataError) {
        console.log(`Failed to fetch from Pinata gateway: ${pinataError.message}`);
        
        // Fallback to public gateway
        const publicUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
        const publicResponse = await axios.get(publicUrl);
        console.log(`Fetched from public gateway: ${ipfsHash}`);
        return publicResponse.data;
      }
    }
  } catch (error) {
    console.error(`Error fetching metadata for hash ${ipfsHash}:`, 
      error.response ? error.response.data : error.message);
    return null;
  }
}

// Fetch image from IPFS
async function fetchImageFromIPFS(imageIpfsHash) {
  try {
    // Get gateway URL from environment variable
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";
    
    // Try different IPFS gateways including the custom one
    const gateways = [
      `https://${gatewayUrl}/ipfs/`,
      "https://gateway.pinata.cloud/ipfs/",
      "https://ipfs.io/ipfs/",
      "https://cloudflare-ipfs.com/ipfs/"
    ];
    
    // Clean the hash (remove ipfs:// prefix if exists)
    const cleanHash = imageIpfsHash.replace('ipfs://', '');
    
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
      console.log(`NFT with token ID ${tokenId} already exists. Updating...`);
      
      // Update NFT data
      existingNFT.owner = owner;
      
      // Update price if available
      if (price) {
        console.log(`Updating price of token ID ${tokenId} to ${price}`);
        existingNFT.price = ethers.utils.formatUnits(price, 'ether');
      }
      
      // Update other fields if needed
      if (royaltyFee) {
        existingNFT.royaltyFee = royaltyFee;
      }
      
      await existingNFT.save();
      console.log(`Updated NFT with token ID ${tokenId}`);
      
      // Update user collections if owner has changed
      if (existingNFT.owner.toLowerCase() !== owner.toLowerCase()) {
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
    
    // If NFT doesn't exist, fetch metadata and create a new one
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

// Main function to fetch and update specific NFTs from contract
async function fetchAndUpdateNFTs() {
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to database. Exiting.");
    return;
  }
  
  try {
    console.log("Starting to fetch and update specific NFTs...");
    
    // Connect to SKALE Network
    const SKALE_RPC_URL = process.env.SKALE_RPC_URL || "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
    const provider = new ethers.providers.JsonRpcProvider(SKALE_RPC_URL);
    console.log("Connected to SKALE network");
    
    // Get contract address from environment variable first, then from our config file
    const contractAddr = process.env.CONTRACT_ADDRESS || contractAddress;
    console.log(`Using contract address: ${contractAddr}`);
    
    // Initialize contract
    const nftContract = new ethers.Contract(contractAddr, abi, provider);
    console.log("Initialized NFT contract");
    
    // List of NFTs to process - can be customized or passed via arguments
    // For this example, we'll process token IDs 1-5
    const tokensToProcess = [1, 2, 3, 4, 5];
    
    console.log(`Will process ${tokensToProcess.length} NFTs with token IDs:`, tokensToProcess);
    
    const results = [];
    
    // Process each token ID
    for (const tokenId of tokensToProcess) {
      try {
        console.log(`Processing token ID ${tokenId}...`);
        
        // Check if token exists by calling ownerOf
        let owner;
        try {
          owner = await nftContract.ownerOf(tokenId);
          console.log(`Owner of token ID ${tokenId}: ${owner}`);
        } catch (error) {
          console.log(`Token ID ${tokenId} doesn't exist or was burned, skipping.`);
          continue;
        }
        
        // Try to get comprehensive NFT details
        let creator, price, royaltyFee, tokenURI, paymentToken;
        
        try {
          // Get complete NFT details from the contract
          const nftDetails = await nftContract.getNFTDetails(tokenId);
          creator = nftDetails.creator;
          owner = nftDetails.owner; // Update with the current owner
          price = nftDetails.price;
          tokenURI = nftDetails.ipfsHash;
          royaltyFee = nftDetails.royaltyFee / 100; // Convert from percentage to decimal
          
          console.log(`Got NFT details for token ID ${tokenId}:`, {
            creator,
            owner,
            price: price.toString(),
            tokenURI,
            royaltyFee
          });
        } catch (error) {
          console.log(`Could not get comprehensive NFT details for token ID ${tokenId}, trying individual calls:`, error.message);
          
          // Get token URI
          try {
            tokenURI = await nftContract.tokenURI(tokenId);
            console.log(`Token URI for ID ${tokenId}: ${tokenURI}`);
          } catch (error) {
            console.log(`Token ID ${tokenId} has no URI, skipping.`);
            continue;
          }
          
          // Try to get creator
          try {
            creator = await nftContract.GetCreatorOfNft(tokenId);
            console.log(`Creator of token ID ${tokenId}: ${creator}`);
          } catch (error) {
            console.log(`Could not get creator for token ID ${tokenId}, using owner as fallback:`, error.message);
            creator = owner;
          }
          
          // Try to get royalty fee
          try {
            const royaltyBasisPoints = await nftContract.getRoyaltyFee(tokenId);
            royaltyFee = royaltyBasisPoints / 100; // Convert from percentage to decimal
            console.log(`Royalty fee for token ID ${tokenId}: ${royaltyFee}`);
          } catch (error) {
            console.log(`Could not get royalty fee for token ID ${tokenId}, using default:`, error.message);
            royaltyFee = 0.05; // Default 5%
          }
          
          // Try to get price
          try {
            price = await nftContract.GetNftPrice(tokenId);
            console.log(`Price for token ID ${tokenId}: ${price.toString()}`);
          } catch (error) {
            console.log(`Could not get price for token ID ${tokenId}, using default:`, error.message);
            price = ethers.utils.parseEther("0.1"); // Default price
          }
        }
        
        // Process the NFT metadata
        const result = await processNFTMetadata(
          tokenId,
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
        console.error(`Error processing token ID ${tokenId}:`, error);
      }
    }
    
    console.log(`Successfully processed ${results.length} NFTs.`);
    
  } catch (error) {
    console.error("Error in fetchAndUpdateNFTs:", error);
  } finally {
    // Close database connection
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the fetch and update function
fetchAndUpdateNFTs(); 
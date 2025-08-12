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

// Fetch metadata from IPFS with multiple gateway fallbacks
async function fetchMetadataFromIPFS(ipfsHash) {
  try {
    // Clean the hash (remove ipfs:// prefix if exists)
    const cleanHash = ipfsHash.replace('ipfs://', '');
    
    // Auth options for Pinata
    const options = process.env.PINATA_JWT ? {
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    } : {};

    // Try different gateways in order
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";
    
    const gateways = [
      `https://${gatewayUrl}/ipfs/${cleanHash}`,
      `https://gateway.pinata.cloud/ipfs/${cleanHash}`,
      `https://ipfs.io/ipfs/${cleanHash}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanHash}`
    ];
    
    // Try each gateway until one works
    for (const gateway of gateways) {
      try {
        console.log(`Trying to fetch metadata from: ${gateway}`);
        const response = await axios.get(gateway, options);
        console.log(`Successfully fetched metadata from: ${gateway}`);
        return response.data;
      } catch (error) {
        console.log(`Failed to fetch from gateway ${gateway}: ${error.message}`);
        continue;
      }
    }
    
    // If we reach here, all gateways failed
    console.error(`Could not fetch metadata from any gateway for hash: ${cleanHash}`);
    return null;
    
  } catch (error) {
    console.error(`Error fetching metadata for hash ${ipfsHash}:`, error.message);
    return null;
  }
}

// Fetch image from IPFS with multiple gateway fallbacks
async function fetchImageFromIPFS(imageIpfsHash) {
  try {
    // Clean the hash (remove ipfs:// prefix if exists)
    const cleanHash = imageIpfsHash.replace('ipfs://', '');
    
    // Try different IPFS gateways
    const gatewayUrl = process.env.GATEWAY_URL || "purple-traditional-earthworm-576.mypinata.cloud";
    
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
        console.log(`Image accessible at: ${url}`);
        return url;
      } catch (error) {
        console.log(`Failed to access image at ${gateway}: ${error.message}`);
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
async function processNFTMetadata(tokenId, metadataURI, creator, owner, price, royaltyFee, paymentToken, transactionHistory) {
  try {
    console.log(`Processing NFT #${tokenId} - Owner: ${owner}, Creator: ${creator}`);
    
    // Check if NFT already exists
    const existingNFT = await NFT.findOne({ tokenId });
    
    if (existingNFT) {
      console.log(`NFT with token ID ${tokenId} already exists. Checking for updates...`);
      
      // Update owner if it has changed
      if (existingNFT.owner.toLowerCase() !== owner.toLowerCase()) {
        console.log(`Updating owner of token ID ${tokenId} from ${existingNFT.owner} to ${owner}`);
        existingNFT.owner = owner;
        
        // Update price
        if (price) {
          const formattedPrice = ethers.utils.formatUnits(price, 'ether');
          console.log(`Updating price of token ID ${tokenId} to ${formattedPrice}`);
          existingNFT.price = formattedPrice;
        }
        
        await existingNFT.save();
        
        // Create transfer transaction if not already recorded
        const lastTransaction = await Transaction.findOne({ 
          tokenId: tokenId,
          to: owner.toLowerCase()
        }).sort({ timestamp: -1 });
        
        if (!lastTransaction || lastTransaction.to !== owner.toLowerCase()) {
          const transaction = new Transaction({
            type: 'transfer',
            nftId: existingNFT._id,
            tokenId: existingNFT.tokenId,
            from: existingNFT.owner,
            to: owner,
            price: 0, // Transfers don't involve a price
            currency: paymentToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'USDC',
            txHash: `0x${Math.random().toString(16).slice(2, 66)}`, // Mock tx hash
            timestamp: new Date()
          });
          
          await transaction.save();
          console.log(`Created transfer transaction for token ID ${tokenId}`);
        }
        
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
    console.log(`Fetching metadata from IPFS for token ID ${tokenId} with hash ${ipfsHash}`);
    const metadata = await fetchMetadataFromIPFS(ipfsHash);
    
    if (!metadata) {
      console.error(`❌ Could not fetch metadata for token ID ${tokenId}. Creating minimal record.`);
      
      // Create a minimal NFT record with available on-chain data
      const nft = new NFT({
        tokenId,
        title: `NFT #${tokenId}`,
        description: "Metadata unavailable",
        image: `https://source.unsplash.com/random/800x800?nft&sig=${tokenId}`,
        price: ethers.utils.formatUnits(price, 'ether'),
        currency: paymentToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'USDC',
        creator: creator,
        owner: owner,
        royaltyFee: royaltyFee || 0.05,
        isListed: true,
        category: "Art",
        rarity: "Common",
        tokenStandard: "ERC-721",
        attributes: [],
        ipfsHash,
        metadataURI,
        createdAt: new Date()
      });
      
      await nft.save();
      console.log(`Created minimal record for NFT #${tokenId} due to missing metadata`);
      
      return nft;
    }
    
    console.log(`Successfully fetched metadata for token ID ${tokenId}:`, metadata.name || `NFT #${tokenId}`);
    
    // Process image URL (might be IPFS hash)
    let imageUrl = metadata.image;
    if (imageUrl && imageUrl.includes('ipfs://')) {
      console.log(`Fetching image from IPFS: ${imageUrl}`);
      imageUrl = await fetchImageFromIPFS(imageUrl);
    }
    
    // If no image URL is available, use a default placeholder
    if (!imageUrl) {
      console.log(`No image URL found for token ID ${tokenId}, using placeholder`);
      imageUrl = `https://source.unsplash.com/random/800x800?nft&sig=${tokenId}`;
    }
    
    // Format price from wei to ether
    const formattedPrice = ethers.utils.formatUnits(price, 'ether');
    console.log(`Price for token ID ${tokenId}: ${formattedPrice} ETH`);
    
    // Create NFT record
    const nft = new NFT({
      tokenId,
      title: metadata.name || `NFT #${tokenId}`,
      description: metadata.description || "",
      image: imageUrl,
      price: formattedPrice,
      currency: paymentToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'USDC',
      creator: creator,
      owner: owner,
      royaltyFee: royaltyFee || metadata.royaltyFee || 0.05,
      isListed: true,
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
    console.log(`✅ Saved NFT with token ID ${tokenId} to database`);
    
    // Create mint transaction
    const transaction = new Transaction({
      type: 'mint',
      nftId: nft._id,
      tokenId: nft.tokenId,
      from: '0x0000000000000000000000000000000000000000', // Zero address
      to: nft.creator,
      price: 0,
      currency: paymentToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'USDC',
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

// Main function to fetch NFTs from blockchain and process them
async function fetchNFTsFromBlockchain() {
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to database. Exiting.");
    return;
  }
  
  try {
    console.log("=== Starting to fetch NFT data from blockchain and IPFS ===");
    
    // Connect to SKALE Network
    const SKALE_RPC_URL = process.env.SKALE_RPC_URL || "https://mainnet.skalenodes.com/v1/green-giddy-denebola";
    const provider = new ethers.providers.JsonRpcProvider(SKALE_RPC_URL);
    console.log(`Connected to blockchain at: ${SKALE_RPC_URL}`);
    
    // Get contract address from environment variable first, then from our config file
    const contractAddr = process.env.CONTRACT_ADDRESS || contractAddress;
    console.log(`Using contract address: ${contractAddr}`);
    
    // Initialize contract with the provided address
    const nftContract = new ethers.Contract(contractAddr, abi, provider);
    console.log("Initialized NFT contract instance");
    
    // Get total supply using GetCurrentToken
    let totalSupply;
    
    try {
      totalSupply = await nftContract.GetCurrentToken();
      console.log(`📊 Total NFTs minted according to GetCurrentToken(): ${totalSupply.toString()}`);
    } catch (error) {
      console.error("❌ Error fetching total supply:", error.message);
      console.log("Exiting script due to contract connection error.");
      return;
    }
    
    // Convert BigNumber to regular number
    const maxTokenId = totalSupply.toNumber();
    
    console.log(`Will process tokens from ID 1 to ${maxTokenId}`);
    
    // Process each token
    const results = [];
    for (let i = 1; i <= maxTokenId; i++) {
      try {
        console.log(`\n--- Processing token ID ${i} (${i} of ${maxTokenId}) ---`);
        
        // Check if token exists and get owner
        let owner;
        try {
          owner = await nftContract.ownerOf(i);
          console.log(`Owner of token ID ${i}: ${owner}`);
        } catch (error) {
          console.log(`Token ID ${i} doesn't exist or was burned, skipping.`);
          continue;
        }
        
        // Get detailed NFT information from the getNFTDetails function
        try {
          console.log(`Fetching details for NFT #${i} from smart contract...`);
          const nftDetails = await nftContract.getNFTDetails(i);
          
          const creator = nftDetails.creator;
          owner = nftDetails.owner; // Use the current owner returned by getNFTDetails
          const price = nftDetails.price;
          const tokenURI = nftDetails.ipfsHash;
          const royaltyFee = nftDetails.royaltyFee / 100; // Convert from percentage to decimal
          const paymentToken = nftDetails.paymentToken;
          const transactionHistory = nftDetails.transactionHistory;
          
          console.log(`NFT #${i} details:`);
          console.log(`- Creator: ${creator}`);
          console.log(`- Owner: ${owner}`);
          console.log(`- Price: ${ethers.utils.formatUnits(price, 'ether')}`);
          console.log(`- Token URI: ${tokenURI}`);
          console.log(`- Royalty Fee: ${royaltyFee}`);
          console.log(`- Payment Token: ${paymentToken}`);
          console.log(`- Transaction History: ${transactionHistory.length} entries`);
          
          // Process the NFT metadata
          const result = await processNFTMetadata(
            i, 
            tokenURI, 
            creator, 
            owner, 
            price, 
            royaltyFee,
            paymentToken,
            transactionHistory
          );
          
          if (result) {
            results.push(result);
            console.log(`✅ Successfully processed NFT #${i}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching comprehensive details for token ID ${i}:`, error.message);
          
          // Fall back to individual function calls if getNFTDetails fails
          try {
            console.log("Falling back to individual function calls...");
            
            // Get token URI
            const tokenURI = await nftContract.tokenURI(i);
            console.log(`Token URI for ID ${i}: ${tokenURI}`);
            
            // Get creator
            const creator = await nftContract.GetCreatorOfNft(i);
            console.log(`Creator of token ID ${i}: ${creator}`);
            
            // Get price
            const price = await nftContract.GetNftPrice(i);
            console.log(`Price for token ID ${i}: ${price.toString()}`);
            
            // Get royalty fee
            const royaltyFee = await nftContract.getRoyaltyFee(i) / 100;
            console.log(`Royalty fee for token ID ${i}: ${royaltyFee}`);
            
            // For payment token and transaction history, we'll use defaults
            const paymentToken = "0x0000000000000000000000000000000000000000"; // Default to ETH
            const transactionHistory = [creator, owner];
            
            // Process the NFT metadata with individual function calls
            const result = await processNFTMetadata(
              i, 
              tokenURI, 
              creator, 
              owner, 
              price, 
              royaltyFee,
              paymentToken,
              transactionHistory
            );
            
            if (result) {
              results.push(result);
              console.log(`✅ Successfully processed NFT #${i} using individual function calls`);
            }
          } catch (fallbackError) {
            console.error(`❌ Complete failure processing token ID ${i}:`, fallbackError.message);
          }
        }
      } catch (error) {
        console.error(`❌ Unexpected error processing token ID ${i}:`, error.message);
      }
    }
    
    console.log(`\n=== Import Summary ===`);
    console.log(`Successfully processed ${results.length} out of ${maxTokenId} NFTs.`);
    
  } catch (error) {
    console.error("❌ Fatal error in fetchNFTsFromBlockchain:", error);
  } finally {
    // Close database connection
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the import function
console.log("==== NapFT NFT Import Script ====");
console.log("Starting import process...");
fetchNFTsFromBlockchain();

require("dotenv").config();
const { ethers } = require("ethers");
const { contractAddress, abi } = require("./contractConfig");

async function testContract() {
  try {
    console.log("===== Testing Contract Connection =====");
    console.log("Contract address:", process.env.CONTRACT_ADDRESS || contractAddress);
    
    // Connect to SKALE Network
    const SKALE_RPC_URL = process.env.SKALE_RPC_URL || "https://mainnet.skalenodes.com/v1/green-giddy-denebola";
    console.log("RPC URL:", SKALE_RPC_URL);
    
    // Create provider
    const provider = new ethers.providers.JsonRpcProvider(SKALE_RPC_URL);
    console.log("Successfully created provider");
    
    // Get network info
    const network = await provider.getNetwork();
    console.log("Connected to network:", network.name, `(chainId: ${network.chainId})`);
    
    // Initialize contract
    const nftContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS || contractAddress, 
      abi, 
      provider
    );
    console.log("Contract interface initialized");
    
    // Test individual functions
    console.log("\n===== Testing Contract Functions =====");
    
    // Try GetCurrentToken() (totalSupply)
    console.log("\nTesting GetCurrentToken() function:");
    try {
      const totalSupply = await nftContract.GetCurrentToken();
      console.log("✓ GetCurrentToken() successful:", totalSupply.toString());
    } catch (error) {
      console.log("✗ GetCurrentToken() failed:", error.message);
    }
    
    // Try ownerOf(1) - First token
    console.log("\nTesting ownerOf(1) function:");
    try {
      const owner = await nftContract.ownerOf(1);
      console.log("✓ ownerOf(1) successful:", owner);
    } catch (error) {
      console.log("✗ ownerOf(1) failed:", error.message);
    }
    
    // Try tokenURI(1) - First token
    console.log("\nTesting tokenURI(1) function:");
    try {
      const tokenURI = await nftContract.tokenURI(1);
      console.log("✓ tokenURI(1) successful:", tokenURI);
    } catch (error) {
      console.log("✗ tokenURI(1) failed:", error.message);
    }
    
    // Try GetCreatorOfNft(1)
    console.log("\nTesting GetCreatorOfNft(1) function:");
    try {
      const creator = await nftContract.GetCreatorOfNft(1);
      console.log("✓ GetCreatorOfNft(1) successful:", creator);
    } catch (error) {
      console.log("✗ GetCreatorOfNft(1) failed:", error.message);
    }
    
    // Try GetNftPrice(1)
    console.log("\nTesting GetNftPrice(1) function:");
    try {
      const price = await nftContract.GetNftPrice(1);
      console.log("✓ GetNftPrice(1) successful:", ethers.utils.formatUnits(price, 'ether'), "ETH");
    } catch (error) {
      console.log("✗ GetNftPrice(1) failed:", error.message);
    }
    
    // Try getRoyaltyFee(1)
    console.log("\nTesting getRoyaltyFee(1) function:");
    try {
      const royaltyFee = await nftContract.getRoyaltyFee(1);
      console.log("✓ getRoyaltyFee(1) successful:", royaltyFee.toString(), "% (", royaltyFee / 100, "decimal)");
    } catch (error) {
      console.log("✗ getRoyaltyFee(1) failed:", error.message);
    }
    
    // Try getNFTDetails(1)
    console.log("\nTesting getNFTDetails(1) function:");
    try {
      const details = await nftContract.getNFTDetails(1);
      console.log("✓ getNFTDetails(1) successful:");
      console.log("  - Creator:", details.creator);
      console.log("  - Owner:", details.owner);
      console.log("  - Price:", ethers.utils.formatUnits(details.price, 'ether'), "ETH");
      console.log("  - Payment Token:", details.paymentToken);
      console.log("  - IPFS Hash:", details.ipfsHash);
      console.log("  - Royalty Fee:", details.royaltyFee.toString(), "%");
      console.log("  - Transaction History:", details.transactionHistory);
    } catch (error) {
      console.log("✗ getNFTDetails(1) failed:", error.message);
    }
    
    console.log("\n===== Scan for Valid Token IDs =====");
    // Try to find some valid token IDs by scanning
    console.log("Scanning for valid tokens (1-10)...");
    for (let i = 1; i <= 10; i++) {
      try {
        const owner = await nftContract.ownerOf(i);
        console.log(`✓ Token ID ${i} exists, owned by ${owner}`);
        
        // For valid tokens, also try to get their tokenURI
        try {
          const tokenURI = await nftContract.tokenURI(i);
          console.log(`  - Token URI: ${tokenURI}`);
        } catch (error) {
          console.log(`  - Couldn't fetch tokenURI: ${error.message}`);
        }
      } catch (error) {
        console.log(`✗ Token ID ${i} doesn't exist or was burned`);
      }
    }
    
    console.log("\n===== End of Test =====");
    console.log("If functions failed, check that:");
    console.log("1. The contract address is correct");
    console.log("2. The RPC URL is valid and accessible");
    console.log("3. The ABI matches the deployed contract");
    console.log("4. The token IDs you're testing actually exist");
    
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

// Run the test
testContract(); 
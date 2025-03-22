require("dotenv").config();
const { contractAddress, abi } = require("./contractConfig");
const axios = require("axios");

async function testConfig() {
  console.log("===== Testing Configuration =====");
  
  // Contract configuration
  console.log("\n--- Contract Configuration ---");
  console.log("Contract address from config:", contractAddress);
  console.log("Contract address from env:", process.env.CONTRACT_ADDRESS || "Not set");
  console.log("Number of ABI functions:", abi.length);
  
  // Network configuration
  console.log("\n--- Network Configuration ---");
  console.log("SKALE RPC URL:", process.env.SKALE_RPC_URL ? maskURL(process.env.SKALE_RPC_URL) : "Not set");
  
  // IPFS configuration
  console.log("\n--- IPFS Configuration ---");
  console.log("Pinata Gateway URL:", process.env.GATEWAY_URL || "Not set (will use 'purple-traditional-earthworm-576.mypinata.cloud')");
  console.log("Pinata JWT:", process.env.PINATA_JWT ? "Set (masked for security)" : "Not set");
  console.log("Pinata API Key:", process.env.PINATA_API_KEY ? "Set (masked for security)" : "Not set");
  console.log("Pinata API Secret:", process.env.PINATA_API_SECRET ? "Set (masked for security)" : "Not set");
  
  // Database configuration
  console.log("\n--- Database Configuration ---");
  console.log("MongoDB URI:", process.env.MONGODB_URI ? maskURL(process.env.MONGODB_URI) : "Not set");
  console.log("===================================");
  
  // Check Pinata connection
  if (process.env.PINATA_JWT) {
    console.log("\nTesting Pinata connection...");
    try {
      const response = await axios.get("https://api.pinata.cloud/data/testAuthentication", {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`
        }
      });
      console.log("✓ Pinata authentication successful!");
    } catch (error) {
      console.error("✗ Pinata authentication failed:", error.message);
      if (error.response) {
        console.log("Response status:", error.response.status);
        console.log("Response data:", error.response.data);
      }
    }
  }
  
  // Check required variables
  console.log("\n--- Configuration Summary ---");
  checkRequiredVar("CONTRACT_ADDRESS", process.env.CONTRACT_ADDRESS || contractAddress);
  checkRequiredVar("SKALE_RPC_URL", process.env.SKALE_RPC_URL);
  checkRequiredVar("MONGODB_URI", process.env.MONGODB_URI);
  
  // Check optional but recommended variables
  console.log("\n--- Optional Variables ---");
  checkRecommendedVar("PINATA_JWT", process.env.PINATA_JWT);
  checkRecommendedVar("GATEWAY_URL", process.env.GATEWAY_URL);
  
  console.log("\n--- Instructions ---");
  console.log("1. To run the test contract connection script: npm run test-contract");
  console.log("2. To import NFTs from contract: npm run import-contract");
  console.log("3. To fetch specific NFTs: npm run fetch-nfts");
  
  console.log("\nIf you're missing any required variables, add them to your .env file.");
  console.log("Example .env format can be found in .env.example");
}

function maskURL(url) {
  if (!url) return "Not set";
  try {
    // For MongoDB URIs (mongodb://username:password@host:port/database)
    if (url.includes('@')) {
      // Hide password
      return url.replace(/\/\/([^:]+):([^@]+)@/, '//[username]:[hidden]@');
    }
    // For other URLs, just show the domain
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/*****`;
  } catch (e) {
    // If URL parsing fails, just mask most of it
    return url.substring(0, 10) + "..." + url.substring(url.length - 5);
  }
}

function checkRequiredVar(name, value) {
  if (value) {
    console.log(`✓ ${name} is set`);
  } else {
    console.log(`✗ ERROR: ${name} is not set but is required`);
  }
}

function checkRecommendedVar(name, value) {
  if (value) {
    console.log(`✓ ${name} is set`);
  } else {
    console.log(`○ WARNING: ${name} is not set (recommended but optional)`);
  }
}

// Run the test
testConfig(); 
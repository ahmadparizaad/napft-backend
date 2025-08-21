
const rateLimit = require('express-rate-limit');
const { ethers } = require("ethers");
const { mineGasForTransactionAsync } = require("@eidolon-labs/gasless");
const chains = require("../config/chains");

// Rate limiter: max 5 requests per minute per IP
// const sfuelLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 5,
//   message: { error: "Too many requests, please try again later." }
// });

exports.distributeSFuel = async (req, res) => {
  try {
    console.log('[sFuel] Incoming request:', req.body);
    const { chainName, chainType, receiver } = req.body;

    // Basic validation
    if (!chains[chainName] || !chains[chainName].chainInfo[chainType]) {
      console.error(`[sFuel] Invalid chain name or type:`, chainName, chainType);
      return res.status(400).json({ error: "Invalid chain name or type." });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(receiver)) {
      console.error(`[sFuel] Invalid receiver address:`, receiver);
      return res.status(400).json({ error: "Invalid receiver address." });
    }

    const { rpcUrl, proofOfWork, functionSignature } = chains[chainName].chainInfo[chainType];
    console.log(`[sFuel] Using RPC: ${rpcUrl}, Contract: ${proofOfWork}, Function: ${functionSignature}`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const randomWallet = ethers.Wallet.createRandom().connect(provider);
    console.log(`[sFuel] Random wallet address: ${randomWallet.address}`);

    const nonce = await provider.getTransactionCount(randomWallet.address);
    console.log(`[sFuel] Wallet nonce: ${nonce}`);
    const { gasPrice } = await mineGasForTransactionAsync(10000000, randomWallet.address, nonce);
    console.log(`[sFuel] Mined gas price: ${gasPrice}`);

    // Prepare data
    const data = functionSignature + "000000000000000000000000" + receiver.substring(2);
    console.log(`[sFuel] Transaction data: ${data}`);

    const tx = await randomWallet.sendTransaction({
      to: proofOfWork,
      data,
      value: 0,
      gasLimit: 10000000,
      gasPrice
    });
    console.log(`[sFuel] Sent transaction:`, tx);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`[sFuel] Transaction receipt:`, receipt);

    res.json({
      success: true,
      txHash: tx.hash,
      status: receipt.status
    });
  } catch (err) {
    console.error('[sFuel] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// exports.sfuelLimiter = sfuelLimiter;
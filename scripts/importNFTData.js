const fetchNFTData = async() => {
    const totalSupply = await nftContract.GetCurrentToken();
    console.log("✓ GetCurrentToken() successful:", totalSupply.toString());
    
    for (let i = 1; i <= totalSupply; i++) {
        const creator = await nftContract.GetCreatorOfNft(i);
        const owner = await nftContract.ownerOf(i);
        const price = await nftContract.GetNftPrice(i);
        const paymentToken = await nftContract.GetPaymentToken(i);
        const ipfsHash = await nftContract.GetIpfsHash(i);
        const royaltyFee = await nftContract.getRoyaltyFee(i);
        const transactionHistory = await nftContract.GetTransactionHistory(i);
        
        console.log(`\nNFT ID: ${i}`);
        console.log(`Creator: ${creator}`);
        console.log(`Owner: ${owner}`);
        console.log(`Price: ${ethers.utils.formatUnits(price, 'ether')} ETH`);
        console.log(`Payment Token: ${paymentToken}`);
        console.log(`IPFS Hash: ${ipfsHash}`);
        console.log(`Royalty Fee: ${royaltyFee}% (${royaltyFee / 100} decimal)`);
        console.log(`Transaction History: ${transactionHistory}`);
    }
}
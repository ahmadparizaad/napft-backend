const User = require('../models/User');
const NFT = require('../models/NFT');
const { validationResult } = require('express-validator');

// Get user profile by address
exports.getUserByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    
    let user = await User.findOne({ address });
    
    if (!user) {
      // Create a basic user profile if it doesn't exist
      user = await User.create({ address });
    }
    
    // Get created NFTs
    const createdNFTs = await NFT.find({ creator: address });
    
    // Get owned NFTs
    const ownedNFTs = await NFT.find({ owner: address });
    
    // Return user data with NFTs
    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        createdNFTs,
        ownedNFTs
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user profile
exports.updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }
    
    const { address } = req.params;
    
    // Check if address in params matches the address in the body
    if (req.body.address && req.body.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }
    
    // Find the user
    let user = await User.findOne({ address });
    
    if (!user) {
      // Create a new user if doesn't exist
      user = new User({
        address,
        ...req.body
      });
    } else {
      // Update allowed fields
      const allowedUpdates = [
        'username',
        'bio',
        'profileImage',
        'coverImage',
        'email',
        'socials'
      ];
      
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          if (field === 'socials') {
            user.socials = {
              ...user.socials,
              ...req.body.socials
            };
          } else if (field === 'profileImage' || field === 'coverImage') {
            // For profile or banner image, verify user owns the NFT if it's an NFT image
            // This is a simplified check - in production you'd verify the NFT ownership
            user[field] = req.body[field];
          } else {
            user[field] = req.body[field];
          }
        }
      });
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get user stats
exports.getUserStats = async (req, res) => {
  try {
    const { address } = req.params;
    
    // Count NFTs created
    const createdCount = await NFT.countDocuments({ creator: address });
    
    // Count NFTs owned
    const ownedCount = await NFT.countDocuments({ owner: address });
    
    // Get total volume
    const user = await User.findOne({ address });
    const totalVolume = user ? user.totalVolume : 0;
    
    res.status(200).json({
      success: true,
      data: {
        createdCount,
        ownedCount,
        totalVolume
      }
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error.message
    });
  }
};

// Follow a user
exports.followUser = async (req, res) => {
  try {
    const { followerAddress, followingAddress } = req.body;
    
    // Validate request body
    if (!followerAddress || !followingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Both followerAddress and followingAddress are required'
      });
    }
    
    // Check if they're the same address
    if (followerAddress.toLowerCase() === followingAddress.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }
    
    // Find both users
    let follower = await User.findOne({ address: followerAddress });
    let following = await User.findOne({ address: followingAddress });
    
    // Create users if they don't exist
    if (!follower) {
      follower = await User.create({ address: followerAddress });
    }
    
    if (!following) {
      following = await User.create({ address: followingAddress });
    }
    
    // Check if already following
    if (follower.following && follower.following.includes(followingAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }
    
    // Add to following list for follower
    if (!follower.following) {
      follower.following = [];
    }
    follower.following.push(followingAddress);
    
    // Add to followers list for following
    if (!following.followers) {
      following.followers = [];
    }
    following.followers.push(followerAddress);
    
    // Update follower count
    following.followersCount = following.followers.length;
    follower.followingCount = follower.following.length;
    
    // Save both users
    await follower.save();
    await following.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully followed user'
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: error.message
    });
  }
};

// Unfollow a user
exports.unfollowUser = async (req, res) => {
  try {
    const { followerAddress, followingAddress } = req.body;
    
    // Validate request body
    if (!followerAddress || !followingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Both followerAddress and followingAddress are required'
      });
    }
    
    // Find both users
    let follower = await User.findOne({ address: followerAddress });
    let following = await User.findOne({ address: followingAddress });
    
    // Check if users exist
    if (!follower || !following) {
      return res.status(404).json({
        success: false,
        message: 'One or both users not found'
      });
    }
    
    // Check if not following
    if (!follower.following || !follower.following.includes(followingAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Not following this user'
      });
    }
    
    // Remove from following list for follower
    follower.following = follower.following.filter(
      addr => addr.toLowerCase() !== followingAddress.toLowerCase()
    );
    
    // Remove from followers list for following
    following.followers = following.followers.filter(
      addr => addr.toLowerCase() !== followerAddress.toLowerCase()
    );
    
    // Update follower count
    following.followersCount = following.followers.length;
    follower.followingCount = follower.following.length;
    
    // Save both users
    await follower.save();
    await following.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: error.message
    });
  }
};

// Check follow status
exports.getFollowStatus = async (req, res) => {
  try {
    const { followerAddress, followingAddress } = req.query;
    
    // Validate query params
    if (!followerAddress || !followingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Both followerAddress and followingAddress are required'
      });
    }
    
    // Find follower
    const follower = await User.findOne({ address: followerAddress });
    
    // If follower doesn't exist, they are not following anyone
    if (!follower || !follower.following) {
      return res.status(200).json({
        success: true,
        isFollowing: false
      });
    }
    
    // Check if following
    const isFollowing = follower.following.some(
      addr => addr.toLowerCase() === followingAddress.toLowerCase()
    );
    
    res.status(200).json({
      success: true,
      isFollowing
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check follow status',
      error: error.message
    });
  }
};

// Get top traders based on transaction volume
exports.getTopTraders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    console.log(`Fetching top ${limit} traders sorted by volume`);
    
    // Find users with highest trading volume (totalVolume)
    // Also filter out users with no volume or default 0 volume
    const topTraders = await User.find({
      $or: [
        { totalVolume: { $exists: true, $gt: 0 } },
        { volumeTraded: { $exists: true, $gt: 0 } }
      ]
    })
      .sort({ totalVolume: -1, volumeTraded: -1, followersCount: -1 })
      .limit(limit)
      .select('address username name profileImage avatar bio verified volumeTraded totalVolume followersCount followingCount createdAt');
    
    console.log(`Found ${topTraders.length} top traders`);
    
    // Return empty array with success true if no users found
    if (!topTraders || topTraders.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    return res.status(200).json({
      success: true,
      data: topTraders.map(trader => ({
        id: trader._id,
        address: trader.address,
        username: trader.username || trader.name,
        name: trader.name,
        profileImage: trader.profileImage,
        avatar: trader.avatar || trader.profileImage,
        bio: trader.bio,
        verified: trader.verified || false,
        volumeTraded: trader.totalVolume || trader.volumeTraded || 0,
        followers: trader.followersCount || 0,
        following: trader.followingCount || 0,
        createdAt: trader.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching top traders:', error);
    // Return empty array with success false on error
    return res.status(500).json({
      success: false,
      message: 'Error fetching top traders',
      error: error.message,
      data: [] // Include empty data array for easier frontend handling
    });
  }
};

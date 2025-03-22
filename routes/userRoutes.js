const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');

const router = express.Router();

// Validation middleware
const userUpdateValidation = [
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Must be a valid email address'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
];

// Get user by address
router.get('/:address', userController.getUserByAddress);

// Update user profile
router.put('/:address', userUpdateValidation, userController.updateUser);

// Get all users
router.get('/', userController.getAllUsers);

// Get user stats
router.get('/stats/:address', userController.getUserStats);

// Follow a user
router.post('/follow', userController.followUser);

// Unfollow a user
router.post('/unfollow', userController.unfollowUser);

// Check follow status
router.get('/follow-status', userController.getFollowStatus);

// Get top traders
router.get('/top-traders', userController.getTopTraders);

module.exports = router;

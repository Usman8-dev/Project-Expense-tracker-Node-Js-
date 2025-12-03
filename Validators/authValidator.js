const { body } = require('express-validator');

exports.loginValidator = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Email must be valid'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

];
exports.RegisterValidator = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Email must be valid'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    body('age')
        .notEmpty().withMessage('Age is required')
        .isInt({ min: 1, max: 120 }).withMessage('Age must be a valid number')
];
exports.create_AND_upadte_Validation = [
    body('title')
        .notEmpty().withMessage('Title is required'),

    body('amount')
        .notEmpty().withMessage('Amount is required')
        .isInt({ min: 1 }).withMessage('Amount must be a valid number')
];

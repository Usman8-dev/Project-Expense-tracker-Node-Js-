const mongoose = require('mongoose');

/**
 * One document per (user, client operation id).
 * The unique index is what actually prevents a replayed offline write from
 * creating a second record; the stored response lets us answer the retry
 * with the same payload (including the created document's _id).
 */
const IdempotencySchema = new mongoose.Schema({
    opId: {
        type: String,
        required: true,
        trim: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    status: {
        type: String,
        enum: ['in_progress', 'completed'],
        default: 'in_progress',
    },
    statusCode: {
        type: Number,
        default: 0,
    },
    response: {
        type: mongoose.Schema.Types.Mixed,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Hard guarantee against duplicate writes from two racing requests.
IdempotencySchema.index({ user: 1, opId: 1 }, { unique: true });

// Keep the collection small - 7 days far exceeds any realistic sync window.
IdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('idempotency', IdempotencySchema);

const mongoose = require('mongoose');

const FolderModel = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    month: {
        type: String,
        default: null,
    },
    year: {
        type: String,
        default: null,
    },
    theme: {
        type: String,
        enum: ['cyan', 'purple', 'amber', 'emerald', 'rose', 'blue', 'indigo', 'violet', 'pink', 'fuchsia', 'orange', 'teal'],
        default: 'cyan',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('folder', FolderModel);

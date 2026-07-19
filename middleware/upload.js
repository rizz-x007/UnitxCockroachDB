// middleware/upload.js
const multer = require('multer');

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_MIMES   = [...ALLOWED_IMAGE_MIMES, 'application/pdf'];

const imageFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WebP images are permitted.'), false);
    }
};

const docFilter = (req, file, cb) => {
    if (ALLOWED_DOC_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, and PDF documents are permitted.'), false);
    }
};

// Image uploads limit: 5MB max
const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFilter
});

// Document uploads limit: 15MB max
const uploadDoc = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: docFilter
});

module.exports = {
    uploadImage,
    uploadDoc
};
const multer = require('multer');

// Store in memory, not on disk, since we'll stream directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed (JPEG, PNG, WebP)'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB max
    },
    fileFilter: fileFilter
});

module.exports = upload;

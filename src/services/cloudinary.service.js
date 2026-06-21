const { v2: cloudinary } = require('cloudinary');

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

/**
 * Uploads a buffer directly to Cloudinary
 * @param {Buffer} fileBuffer
 * @param {string} folder Optional folder in Cloudinary
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
async function uploadImage(fileBuffer, folder = 'profiles') {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            console.warn('Cloudinary is not configured. Skipping upload and returning empty string.');
            return resolve('');
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folder },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        uploadStream.end(fileBuffer);
    });
}

module.exports = {
    uploadImage,
    cloudinary
};

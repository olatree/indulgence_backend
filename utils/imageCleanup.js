// utils/imageCleanup.js
const cloudinary = require('../config/cloudinary');

exports.cleanupUploadedImages = async (files) => {
  if (!files || files.length === 0) return;
  
  const deletionPromises = files.map(file => 
    cloudinary.uploader.destroy(file.filename)
      .catch(err => console.error(`Failed to delete ${file.filename}:`, err))
  );
  
  await Promise.allSettled(deletionPromises);
};

exports.deleteCloudinaryImages = async (publicIds) => {
  if (!publicIds || publicIds.length === 0) return;
  
  const deletionPromises = publicIds.map(publicId => 
    cloudinary.uploader.destroy(publicId)
      .catch(err => console.error(`Failed to delete ${publicId}:`, err))
  );
  
  await Promise.allSettled(deletionPromises);
};
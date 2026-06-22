import { v2 as cloudinary } from "cloudinary";
import { config } from "../config.js";

// Configure Cloudinary
if (
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret
) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

export async function uploadImage(fileBuffer, folder = "food-delivery") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    uploadStream.end(fileBuffer);
  });
}

// Uploads an array of multer files (with .buffer) and returns their secure URLs.
export async function uploadImages(files = [], folder = "food-delivery") {
  const results = await Promise.all(files.map((file) => uploadImage(file.buffer, folder)));
  return results.map((r) => r.secure_url);
}

export async function deleteImage(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
}

export function getImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    secure: true,
    ...options,
  });
}

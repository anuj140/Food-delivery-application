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

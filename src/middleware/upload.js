import multer from "multer";

// In-memory storage: file buffers are streamed straight to Cloudinary via
// utils/cloudinary.js uploadImage(), so nothing touches local disk.
const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

// Single file under the given field name -> req.file
export const uploadSingle = (field = "photo") => upload.single(field);

// Up to `max` files under the given field name -> req.files
export const uploadArray = (field = "photos", max = 3) => upload.array(field, max);

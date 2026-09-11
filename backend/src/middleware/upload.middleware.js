import multer from "multer";

// Maximum upload file size: 10 MB
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Allowed MIME types for DOCX documents
const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream"
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file) {
    const error = new Error("No file uploaded.");
    error.statusCode = 400;
    return cb(error, false);
  }

  const originalName = file.originalname || "";
  const isDocxExtension = /\.docx$/i.test(originalName);

  if (!isDocxExtension) {
    const error = new Error("Invalid file type: Only Microsoft Word (.docx) files are supported for upload.");
    error.statusCode = 415;
    return cb(error, false);
  }

  const mime = (file.mimetype || "").toLowerCase();
  const isValidMime = ALLOWED_MIME_TYPES.some((allowed) => mime.includes(allowed) || allowed.includes(mime));

  if (!isValidMime) {
    const error = new Error(`Unsupported media type '${file.mimetype}'. Expected a Microsoft Word (.docx) document.`);
    error.statusCode = 415;
    return cb(error, false);
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter
});

/**
 * Express middleware wrapper to cleanly catch Multer-specific errors (such as file size limit exceeded)
 * and return structured HTTP responses.
 */
export const handleDocxUpload = (fieldName = "file") => {
  const uploadSingle = upload.single(fieldName);

  return (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              success: false,
              error: `Uploaded file exceeds the maximum allowed size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
            });
          }
          return res.status(400).json({
            success: false,
            error: `File upload error: ${err.message}`
          });
        }

        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
          success: false,
          error: err.message || "Failed to process uploaded file."
        });
      }

      next();
    });
  };
};

export default handleDocxUpload;

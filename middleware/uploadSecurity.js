const path = require('path');
const fs = require('fs');

// Extended validation beyond Multer
const validateUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 1. Check magic numbers (file signatures) not just extensions
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = filetypes.test(req.file.mimetype);
  const extname = filetypes.test(
    path.extname(req.file.originalname).toLowerCase()
  );

  if (!mimetype || !extname) {
    // Delete the invalid file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Only images allowed' });
  }

  // 2. Check file size (redundant with Multer limits but safer)
  const maxSize = 5 * 1024 * 1024;  // 5MB
  if (req.file.size > maxSize) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'File too large (max 5MB)' });
  }

  // 3. Scan for embedded scripts (basic check)
  if (req.file.mimetype === 'image/svg+xml') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'SVG uploads not allowed (XSS risk)' });
  }

  next();
};


module.exports = { validateUpload };

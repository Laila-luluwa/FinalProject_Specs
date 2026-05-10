const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
//const { upload } = require('../lib/upload');

const { validateUpload } = require('../middleware/uploadSecurity');


// middleware авторизации (как get_current_user)
const { requireAuth } = require('../middleware/auth');

// папка для загрузок
const UPLOAD_DIR = path.join(__dirname, '../uploads/avatars');

// создаём папку если нет
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// настройка multer


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `avatar_${Date.now()}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage }); // ✅ ВОТ ЭТО НУЖНО



// POST /api/uploads/avatar
router.post('/avatar', requireAuth, upload.single('avatar'),validateUpload,async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }

        res.status(201).json({
            message: 'Avatar uploaded successfully',
            filename: req.file
            //path: req.file.path
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

router.post('/avatar', 
  requireAuth, 
  upload.single('avatar'), 
  validateUpload,  // Additional security layer
  async (req, res) => {
    // Process with Sharp...
  }
);


module.exports = router;
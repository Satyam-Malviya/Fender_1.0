const express = require('express');
const multer = require('multer');
const { uploadFileToFolder, listFilesFromFolder, getZippedFolderStream, generateSignedUrl } = require('../utils/s3Helper');
const router = express.Router();
const upload = multer();

// POST /api/folder/upload-file - For uploading individual files within a folder context
router.post('/upload-file', upload.single('file'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const { folderShareId, relativePath } = req.body;
        if (!folderShareId || !relativePath) {
            return res.status(400).json({ error: 'folderShareId and relativePath are required.' });
        }

        const s3Key = `${folderShareId}/${relativePath}`;
        const result = await uploadFileToFolder(req.file, s3Key); // uploadFileToFolder takes file obj and s3Key
        res.status(200).json({
            message: `File ${relativePath} uploaded successfully to folder ${folderShareId}`,
            s3_url: result.Location
        });
    } catch (error) {
        console.error('Folder File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/folder/list/:folderShareId - Lists files in a shared folder
router.get('/list/:folderShareId', async(req, res) => {
    try {
        const { folderShareId } = req.params;
        if (!folderShareId) {
            return res.status(400).json({ error: 'folderShareId is required.' });
        }
        const files = await listFilesFromFolder(folderShareId); // S3 Prefix is folderShareId + '/'
        res.status(200).json({ files }); // files will be an array of {key, name, size, lastModified}
    } catch (error) {
        console.error('List Folder Contents Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/folder/file-link/:folderShareId/:filePath(*) - Generates signed URL for a specific file in a folder
router.get('/file-link/:folderShareId/:filePath(*)', async(req, res) => {
    try {
        const { folderShareId, filePath } = req.params;
        if (!folderShareId || !filePath) {
            return res.status(400).json({ message: 'Folder ID and file path are required.' });
        }
        // Construct the full S3 key for the file within the folder
        const s3Key = `${folderShareId}/${filePath}`;
        const url = await generateSignedUrl(s3Key); // This calls the generic generateSignedUrl from s3Helper

        const fileNameForDownload = filePath.split('/').pop(); // Get the actual filename part

        res.status(200).json({ url, fileName: fileNameForDownload });
    } catch (error) {
        console.error('Error generating specific file link from folder:', error);
        if (error.code === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
            res.status(404).json({ error: 'File not found within the specified folder.' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});


// GET /api/folder/download-zip/:folderShareId - Downloads the entire folder as a ZIP
router.get('/download-zip/:folderShareId', async(req, res) => {
    try {
        const { folderShareId } = req.params;
        if (!folderShareId) {
            return res.status(400).json({ error: 'folderShareId is required.' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderShareId}.zip"`);

        const zipStream = await getZippedFolderStream(folderShareId); // This comes from s3Helper

        zipStream.on('error', (err) => {
            console.error('Error during zipping or streaming to client:', err);
            if (!res.headersSent) {
                // Try to send a JSON error if headers not sent, otherwise just log and end.
                res.status(500).json({ error: 'Error generating ZIP file. ' + err.message });
            } else {
                // If headers already sent, can only end the response. Client might see incomplete download.
                res.end();
            }
        });
        zipStream.pipe(res);

    } catch (error) { // Catch errors from getZippedFolderStream if it throws before returning stream
        console.error('Error preparing ZIP download route:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to initiate ZIP download. ' + error.message });
        }
    }
});

module.exports = router;
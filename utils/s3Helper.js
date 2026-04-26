const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');


const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});


const uploadFile = async(fileObject) => { 
    const fileStream = fs.createReadStream(fileObject.path); 
    
    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: fileObject.originalname, 
        Body: fileStream, 
        ContentType: fileObject.mimetype,
    };
    try {
        return await s3.upload(params).promise();
    } catch (error) {
        console.error("S3 Single File Upload Error:", error);
        throw new Error(`S3 Upload Error: ${error.message}`);
    }
};


const uploadFileToFolder = async(fileObject, s3Key) => {
    const fileStream = fs.createReadStream(fileObject.path);

    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: s3Key, 
        Body: fileStream, 
        ContentType: fileObject.mimetype,
        Metadata: { 
            'original-filename': fileObject.originalname
        }
    };
    try {
        return await s3.upload(params).promise();
    } catch (error) {
        console.error("S3 Upload to Folder Error:", error);
        throw new Error(`S3 Folder Upload Error: ${error.message}`);
    }
};


const generateSignedUrl = async(s3ObjectKey) => {
    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: s3ObjectKey,
        Expires: 60 * 15,
    };
    

    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        console.error("S3 Signed URL Generation Error for key:", s3ObjectKey, error);
        
        throw error; 
    }
};


const listFilesFromFolder = async(folderShareId) => {
    const params = {
        Bucket: S3_BUCKET_NAME,
        Prefix: `${folderShareId}/`
    };
    try {
        const data = await s3.listObjectsV2(params).promise();
        if (!data.Contents) {
            return [];
        }
        return data.Contents.map(item => {
            
            let relativeName = item.Key.substring(folderShareId.length + 1);
            
            if (item.Size === 0 && relativeName.endsWith('/')) {
                return null;
            }
            return {
                key: item.Key, 
                name: relativeName, 
                size: item.Size,
                lastModified: item.LastModified
            };
        }).filter(item => item !== null); 
    } catch (error) {
        console.error("S3 List Files from Folder Error:", error);
        throw new Error(`S3 List Files Error: ${error.message}`);
    }
};

const getZippedFolderStream = async(folderShareId) => {
    const archive = archiver('zip', { zlib: { level: 6 } }); 

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') { console.warn('Archiver ENOENT warning: ', err); } else { console.error('Archiver warning: ', err);
            archive.emit('error', err); } 
    });
    
    archive.on('error', (err) => {
        console.error('Archiver stream has errored:', err);
        
    });

    
    let s3Files;
    try {
        s3Files = await listFilesFromFolder(folderShareId);
    } catch (error) {
        console.error(`Failed to list files for ZIP for folder ${folderShareId}:`, error);
        archive.emit('error', new Error(`Could not list files for zipping: ${error.message}`));
        archive.finalize(); 
        return archive;
    }

    if (!s3Files || s3Files.length === 0) {
        console.log(`No files found for folderShareId: ${folderShareId}. ZIP will be empty or contain only structure.`);
        
        archive.finalize();
        return archive;
    }

    
    for (const file of s3Files) {
        if (file.size > 0) { 
            const s3Stream = s3.getObject({ Bucket: S3_BUCKET_NAME, Key: file.key }).createReadStream();
            s3Stream.on('error', (streamError) => {
                console.error(`Error streaming S3 object ${file.key} for ZIP:`, streamError);
                
                if (!archive.destroyed) {
                    archive.emit('error', new Error(`Failed to stream ${file.name} from S3.`));
                }
            });
            archive.append(s3Stream, { name: file.name }); 
        }
    }

    archive.finalize(); 
    return archive; 
};

module.exports = {
    uploadFile,
    generateSignedUrl,
    uploadFileToFolder,
    listFilesFromFolder,
    getZippedFolderStream
};
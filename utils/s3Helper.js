const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: "AKIAYXWBNYDWGX23WGNX",
    secretAccessKey: "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",
    region: "us-east-1",
});


const uploadFile = async(file) => {
    const params = {
        Bucket: "fenderbucket",
        Key: file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    try {
        const result = await s3.upload(params).promise();
        return result;
    } catch (error) {
        throw new Error(error.message);
    }
};


const generateSignedUrl = async(fileName) => {
    const params = {
        Bucket: "fenderbucket",
        Key: fileName,
        Expires: 60 * 5, // URL expires in 5 minutes
    };
    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = { uploadFile, generateSignedUrl };
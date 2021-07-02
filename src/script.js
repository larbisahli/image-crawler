import fs from 'fs';
import axios from 'axios';
import path from 'path';
import shortid from 'shortid';
import AWS from 'aws-sdk';
import sharp from 'sharp';

require('dotenv').config();

// import sharp from 'sharp'
shortid.characters(
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$£'
);

// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_BUCKET_ENDPOINT);

const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_ACCESS_SECRET_KEY,
});

if (!fs.existsSync('temp')) fs.mkdirSync('temp');

const DeleteTempFileImages = async (TemporaryImages) => {
    try {
        for await (const file of TemporaryImages) {
            fs.unlink(path.join('', file), (err) => {
                if (err) throw err;
            });
        }
    } catch (error) {
        console.error(`Error:<DeleteTempFileImages> `, { error })
    }
};

const ReadAndUpload = async ({ Year, Month, fileName, filePath }, callback) => {
    fs.readFile(filePath, function (err, data) {
        if (err) { throw err; }

        // Buffer Pattern
        const base64data = new Buffer.from(data, 'binary');

        const params = {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: `${Year}/${Month}/${fileName}`,
            Body: base64data,
            ACL: 'public-read',
        };

        s3.putObject(params, function (error, data) {
            if (error) {
                console.log({ error, stack: error.stack });
                callback(error, { success: false, message: error.stack });
            }
            callback(null, {
                success: true,
                filePath: `${Year}/${Month}/${fileName}`,
                ETag: data?.ETag,
            });
        });
    });
};


async function UploadImage({
    url,
    filePath,
    fileName
}) {
    if (!url) return { success: false, message: 'url should not be empty' };

    const newDate = new Date();
    const Month = parseInt(newDate.getMonth() + 1);
    const Year = newDate.getFullYear();
    let TemporaryImages = []

    if (fileName.includes('placeholder')) {
        TemporaryImages.push(filePath)
        TemporaryImages.push(path.join('temp', fileName))
    } else {
        TemporaryImages.push(filePath)
    }

    // base64
    if (!/^https/.test(url) || !/^http/.test(url)) {
        var base64Data = url.replace(/^data:image\/png;base64,/, '');
        return new Promise((resolve, reject) => {
            try {
                fs.writeFile(filePath, base64Data, 'base64', async function (err) {
                    if (err) {
                        DeleteTempFileImages(TemporaryImages);
                        return reject({ success: false, message: err.message });
                    }

                    // Upload image to digitalOcean space
                    if (fileName.includes('placeholder')) {
                        sharp(filePath)
                            .resize(16)
                            .toFile(path.join('temp', fileName), async (err, info) => {
                                if (err) {
                                    console.error(`Error:<sharp>`, { err, info });
                                    throw err;
                                }

                                await ReadAndUpload(
                                    {
                                        Year,
                                        Month,
                                        fileName,
                                        filePath: path.join('temp', fileName),
                                    },
                                    (err, info) => {
                                        if (err) return reject(info);
                                        DeleteTempFileImages(TemporaryImages);
                                        return resolve(info);
                                    }
                                );
                            });
                    } else {

                        await ReadAndUpload(
                            { Year, Month, fileName, filePath },
                            (err, info) => {
                                if (err) return reject(info);
                                DeleteTempFileImages(TemporaryImages);
                                return resolve(info);
                            }
                        );
                    }
                });
            } catch (error) {
                console.error(`Error:`, { error });
                return reject({ success: false, message: error.message });
            }
        });
    }

    // url
    return axios({
        url,
        responseType: 'stream',
    })
        .then(
            (res) =>
                new Promise((resolve, reject) => {
                    res.data
                        .pipe(fs.createWriteStream(filePath))
                        .on('finish', async () => {
                            try {
                                // Upload image to digitalOcean space
                                if (fileName.includes('placeholder')) {
                                    sharp(filePath)
                                        .resize(16)
                                        .toFile(path.join('temp', fileName), async (err, info) => {
                                            if (err) {
                                                console.error(`Error:<sharp>`, { err, info });
                                                throw err;
                                            }

                                            await ReadAndUpload(
                                                {
                                                    Year,
                                                    Month,
                                                    fileName,
                                                    filePath: path.join('temp', fileName),
                                                },
                                                (err, info) => {
                                                    if (err) return reject(info);
                                                    return resolve(info);
                                                }
                                            );
                                        });
                                } else {

                                    await ReadAndUpload(
                                        { Year, Month, fileName, filePath },
                                        (err, info) => {
                                            if (err) return reject(info);
                                            return resolve(info);
                                        }
                                    );
                                }
                            } catch (error) {
                                console.error(`Error:`, { error });
                                return reject({ success: false, message: error.message });
                            }
                        })
                        .on('error', (error) =>
                            reject({ success: false, message: error.message })
                        )
                        .on('close', () => void 0);
                })
        )
        .catch((error) => {
            console.error(`Error:`, { error });
            return { success: false, message: error.message };
        })
        .then((respond) => {
            DeleteTempFileImages(TemporaryImages);
            return respond;
        });
}

async function UploadImageByUrl(url, title, callback) {
    const newDate = new Date();
    const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds

    const imageName = `${title
        .split(' ')
        .join('_')}_${DateAsInt}_${shortid.generate()}`;

    const arr = [
        {
            fileName: `${imageName}.jpg`,
            filePath: path.join('temp', `${imageName}.jpg`),
            isPlaceholder: false,
        },
        {
            fileName: `${imageName}_placeholder.jpg`,
            filePath: path.join(
                'temp',
                `${shortid.generate()}-${shortid.generate()}.jpg`
            ),
            isPlaceholder: true,
        },
    ];

    let results = {};

    for await (const { fileName, filePath, isPlaceholder } of arr) {
        const {
            success,
            message,
            filePath: imgPath,
            ETag,
        } = await UploadImage({ url, filePath, fileName });

        results.success = success;
        if (message) {
            results.message = message;
        } else if (isPlaceholder) {
            results.placeholder = imgPath;
            results.placeholderETag = ETag;
        } else {
            results.imagePath = imgPath;
            results.imageETag = ETag;
        }
    }

    await callback()
    return results;
}


const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM.jpg';

const PrintResults = async () => {
    const Results = await UploadImageByUrl(
        url,
        'product image from ali express',
        () => console.log(`<--- DONE --->`)
    );
    console.log(`====>`, Results);
};

PrintResults();

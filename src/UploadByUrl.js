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


async function UploadImage({ Year, Month, respond }) {
    const params = [
        {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: `${Year}/${Month}/${respond.image.name}`,
            Body: fs.createReadStream(respond.image.path),
            ACL: 'public-read',
        },
        {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: `${Year}/${Month}/${respond.placeholder.name}`,
            Body: fs.createReadStream(respond.placeholder.path),
            ACL: 'public-read',
        }
    ]

    return await Promise.all(params.map(param => s3.putObject(param).promise()))
}


export default async function UploadImageByUrl(url, title) {
    if (!url) return { success: false, message: 'url should not be empty' };

    const newDate = new Date();
    const Month = parseInt(newDate.getMonth() + 1);
    const Year = newDate.getFullYear();
    const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds
    const imageName = `${title.split(' ').join('_')}_${DateAsInt}_${shortid.generate()}`;
    const filePath = path.join('temp', `${imageName}.jpg`)

    return new Promise((resolve, reject) => {

        // base64
        if (!/^https/.test(url) || !/^http/.test(url)) {
            var base64Data = url.replace(/^data:image\/png;base64,/, '');
            fs.writeFile(filePath, base64Data, 'base64', async function (error) {
                if (error) {
                    return reject({ success: false, error });
                }

                sharp(filePath)
                    .resize(16)
                    .toFile(path.join('temp', `${imageName}_placeholder.jpg`), async (error, info) => {
                        if (error) {
                            console.error(`Error:<sharp>`, { error, info });
                            return reject({ success: false, error });
                        }

                        return resolve({
                            success: true,
                            image: {
                                name: `${imageName}.jpg`,
                                path: filePath
                            },
                            placeholder: {
                                name: `${imageName}_placeholder.jpg`,
                                path: path.join('temp', `${imageName}_placeholder.jpg`)
                            }
                        });
                    });
            });
        } else {
            // url
            axios({
                url,
                responseType: 'stream',
            }).then(
                (res) =>
                    res.data
                        .pipe(fs.createWriteStream(filePath))
                        .on('finish', async () => {
                            sharp(filePath)
                                .resize(16)
                                .toFile(path.join('temp', `${imageName}_placeholder.jpg`), async (error, info) => {
                                    if (error) {
                                        console.error(`Error:<sharp>`, { error, info });
                                        return reject({ success: false, error });
                                    }

                                    return resolve(
                                        {
                                            success: true,
                                            image: {
                                                name: `${imageName}.jpg`,
                                                path: filePath
                                            },
                                            placeholder: {
                                                name: `${imageName}_placeholder.jpg`,
                                                path: path.join('temp', `${imageName}_placeholder.jpg`)
                                            }
                                        }
                                    );
                                });
                        })
                        .on('error', (error) =>
                            reject({ success: false, error })
                        )
                        .on('close', () => void 0))
        }
    }).then(async (respond) => {

        const img_res = await UploadImage({ Year, Month, respond });

        respond['image'].ETag = img_res[0].ETag
        respond['placeholder'].ETag = img_res[1].ETag

        return respond

    }).then((respond) => {

        const { image, placeholder } = respond
        const arr = [image.path, placeholder.path]

        DeleteTempFileImages(arr)

        return {
            image: { path: image.path, ETag: image.ETag },
            placeholder: { path: placeholder.path, ETag: placeholder.ETag }
        }
    })
}
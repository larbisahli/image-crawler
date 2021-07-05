import fs from 'fs';
import axios from 'axios';
import path from 'path';
import shortid from 'shortid';
import AWS from 'aws-sdk';
import sharp from 'sharp';

require('dotenv').config();

shortid.characters(
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$£'
);

// RegEx to validate Base64 data url
const Base64Regex = /^data:image\/(?:gif|png|jpeg|jpg|bmp|webp|svg\+xml)(?:;charset=utf-8)?;base64,(?:[A-Za-z0-9]|[+/])+={0,2}/;

// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_BUCKET_ENDPOINT);

const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_ACCESS_SECRET_KEY,
});

if (!fs.existsSync('temp')) fs.mkdirSync('temp');


const base64MimeType = (encoded) => {
    let result = null;
    if (typeof encoded !== 'string') return result;
    const mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    if (mime && mime.length) result = mime[1];
    return result;
}

const DeleteTemporaryImages = async (TemporaryImages) => {
    try {
        for await (const file of TemporaryImages) {
            fs.unlink(path.join('', file), (err) => {
                if (err) throw err;
            });
        }
    } catch (error) {
        console.error(`Error:<DeleteTemporaryImages> `, { error })
    }
};

async function UploadImage({ Year, Month, respond }) {
    const params = [
        {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: `${Year}/${Month}/${respond?.image.name}`,
            Body: fs.createReadStream(respond?.image.path),
            ACL: 'public-read',
        },
        {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: `${Year}/${Month}/${respond?.placeholder.name}`,
            Body: fs.createReadStream(respond?.placeholder.path),
            ACL: 'public-read',
        }
    ]

    return await Promise.all(params.map(param => s3.putObject(param).promise()))
}

export default async function UploadImageByUrl(url, title) {
    if (!url) return { success: false, message: 'url should not be empty' };

    const newDate = new Date();
    const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds
    const Month = parseInt(newDate.getMonth() + 1);
    const Year = newDate.getFullYear();
    const imageName = `${title.split(' ').join('_')}_${DateAsInt}_${shortid.generate()}`;

    return new Promise((resolve, reject) => {

        // base64
        if (Base64Regex.test(url)) {
            const base64Data = url.split(',')[1];

            let FileExtension = base64MimeType(url).split('/')[1]
            let Image = `${imageName}.${FileExtension}`
            let Placeholder = `${imageName}_placeholder.${FileExtension}`
            let Base64ImagePath = path.join('temp', Image)

            fs.writeFile(Base64ImagePath, base64Data, 'base64', async function (error) {

                if (error && !FileExtension) {
                    return reject({ error: !error ? error : 'There was no file extension specified' });
                }

                sharp(Base64ImagePath)
                    .resize(16)
                    .toFile(path.join('temp', Placeholder), async (error, info) => {
                        if (error) {
                            console.error(`Error:<sharp>`, { error, info });
                            return reject({ error });
                        }

                        return resolve({
                            image: {
                                name: Image,
                                path: Base64ImagePath
                            },
                            placeholder: {
                                name: Placeholder,
                                path: path.join('temp', Placeholder)
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
                (res) => {
                    let FileExtension = res.headers['content-type'].split('/')[1]
                    let Image = `${imageName}.${FileExtension}`
                    let Placeholder = `${imageName}_placeholder.${FileExtension}`
                    let imagePath = path.join('temp', Image)

                    return res.data
                        .pipe(fs.createWriteStream(imagePath))
                        .on('finish', async () => {
                            sharp(imagePath)
                                .resize(16)
                                .toFile(path.join('temp', Placeholder), async (error, info) => {

                                    if (error && !FileExtension) {
                                        console.error(`Error:<sharp>`, { error, info });
                                        return reject({ error: !error ? error : 'There was no file extension specified' });
                                    }

                                    return resolve(
                                        {
                                            image: {
                                                name: Image,
                                                path: imagePath
                                            },
                                            placeholder: {
                                                name: Placeholder,
                                                path: path.join('temp', Placeholder)
                                            }
                                        }
                                    );
                                });
                        })
                        .on('error', (error) =>
                            reject({ error })
                        )
                        .on('close', () => void 0)
                })
        }
    }).then(async (respond) => {

        const img_res = await UploadImage({ Year, Month, respond });

        respond['image'].ETag = img_res[0].ETag
        respond['placeholder'].ETag = img_res[1].ETag

        return respond

    }).then((respond) => {

        const { image, placeholder } = respond
        const arr = [image.path, placeholder.path]

        DeleteTemporaryImages(arr)

        return {
            image: {
                path: `/${Year}/${Month}/${image.name}`,
                ETag: image.ETag
            },
            placeholder: {
                path: `/${Year}/${Month}/${placeholder.name}`,
                ETag: placeholder.ETag
            }
        }
    })
}

const url = 'data:image/jpg;base64,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'

const PrintResults = async (url) => {

    // const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM.jpg';
    const title = 'product image from ali express';

    const { image, placeholder, error } = await UploadImageByUrl(
        url,
        title
    );

    console.log(`==>`, { image, placeholder, error })
};

PrintResults(url);

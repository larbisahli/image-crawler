
import fs from 'fs'
import axios from 'axios'
import path from 'path'
import shortid from 'shortid'
import AWS from 'aws-sdk';

// import sharp from 'sharp'
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$£');

// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_BUCKET_ENDPOINT);

const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_ACCESS_KEY
});

if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp');
}

const DeleteTempFileImages = () => {
    try {
        fs.readdir('temp', async (err, files) => {
            if (err) throw err;
            for await (const file of files) {
                fs.unlink(path.join('temp', file), (err) => {
                    if (err) throw err;
                });
            }
        });
    } catch (error) {
        console.log(`DeleteTempFileImages Error: `, { error })
    }
}

const Upload = ({ Year, Month, imageFile, filePath }) => {

    const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: `${Year}/${Month}/${imageFile}`,
        SourceFile: filePath,
        ACL: 'public-read',
        // Metadata: {
        //     "x-amz-meta-my-key": "your-value"
        // }
    };

    s3.putObject(params, function (error, data) {
        return { error, data }
    });
}

export async function DownloadImage(url, imageName, callback = () => void 0) {

    if (!url) return { success: false, message: 'url should not be empty' }

    const newDate = new Date();
    const Month = parseInt(newDate.getMonth() + 1)
    const Year = newDate.getFullYear();

    const DateAsInt = Math.round(newDate.getTime() / 1000) // in seconds

    let imageFile = `${imageName.split(' ').join('_')}_${DateAsInt}_${shortid.generate()}.jpg`
    const filePath = path.join('temp', imageFile)

    if (!/^https/.test(url) || !/^http/.test(url)) {
        var base64Data = url.replace(/^data:image\/png;base64,/, "");
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, base64Data, 'base64', function (err) {
                if (err) {
                    DeleteTempFileImages()
                    reject({ success: false, message: err.message })
                }

                // Upload image to digitalOcean space
                const { error, data } = Upload({ Year, Month, imageFile, filePath })

                if (error) {
                    console.log({ error, stack: error.stack })
                    return reject({ success: false, message: error.stack })
                }
                console.log('===> ', { data })

                callback()
                DeleteTempFileImages()
                return resolve({ success: true, imagePath: `${Year}/${Month}/${imageFile}` })
            })
        })
    }

    return axios({
        url,
        responseType: 'stream'
    }).then(res =>
        new Promise((resolve, reject) => {
            res.data
                .pipe(fs.createWriteStream(filePath))
                .on('finish', async () => {

                    try {

                        // Upload image to digitalOcean space
                        const { error, data } = Upload({ Year, Month, imageFile, filePath })

                        if (error) {
                            console.log({ error, stack: error.stack })
                            return reject({ success: false, message: error.stack })
                        }
                        console.log('===> ', { data })
                        return resolve({ success: true, imagePath: `${Year}/${Month}/${imageFile}` })

                    }
                    catch (error) {
                        return reject({ success: false, message: error.message })
                    }
                })
                .on('error', (error) => reject({ success: false, message: error.message }))
                .on('close', callback)
        })
    )
        .catch((error) => {
            return { success: false, message: error.message }
        })
        .then((respond) => {
            console.log(`BOOM`)
            DeleteTempFileImages()
            return respond
        })
}


const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM.jpg'

async function GetImageByUrl(url) {
    const Results = await DownloadImage(url, 'product image from ali express', () => console.log(`<--- DONE --->`))
    console.log(`====>`, Results)
}

GetImageByUrl(url)



import fs from 'fs'
import axios from 'axios'
import path from 'path'
import shortid from 'shortid'

shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$£');

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

const DownloadImage = async (url, callback = () => void 0) => {

    if (!url) return { success: false, message: 'url should not be empty' }

    let imageFileName = `NIS_${shortid.generate()}.jpg`

    const filepath = path.join('temp', imageFileName)

    // const mimetype = 'image/jpeg'
    // let imageToBeUploaded = { filepath, mimetype }

    // resized => RE
    // Normal Image size => NIS

    if (!/^https/.test(url) || !/^http/.test(url)) {
        var base64Data = url.replace(/^data:image\/png;base64,/, "");
        return new Promise((resolve, reject) => {
            fs.writeFile(filepath, base64Data, 'base64', function (error) {
                if (error) {
                    DeleteTempFileImages()
                    reject({ success: false, message: error.message })
                }

                //  Resize & Upload image to a space

                // -----------------
                callback()
                DeleteTempFileImages()
                return resolve({ success: true })
            })
        })
    }

    return axios({
        url,
        responseType: 'stream'
    }).then(res =>
        new Promise((resolve, reject) => {
            res.data
                .pipe(fs.createWriteStream(filepath))
                .on('finish', () => {

                    try {
                        // Resize & Upload image to a space
                    }
                    catch (error) {
                        return reject({ success: false, message: error.message })
                    }

                    return resolve({ success: true })
                })
                .on('error', (error) => reject({ success: false, message: error.message }))
                .on('close', callback)
        })
    )
        .catch((error) => {
            return { success: false, message: error.message }
        })
        .then((respond) => {
            DeleteTempFileImages()
            return respond
        })
}


const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM_.jpg'

async function GetImageByUrl(url) {
    const Results = await DownloadImage(url, () => console.log(`<--- DONE --->`))
    console.log(`====>`, Results)
}

GetImageByUrl(url)


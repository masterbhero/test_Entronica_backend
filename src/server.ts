import express from 'express';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs'
import cors from 'cors'

const app = express();
const port = 3000;

app.use(cors())
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

const storage = "data"

app.get('/', (req, res) => {
    res.send('Server Running ok');
});

app.get('/view-all', (req, res) => {
    try {
        if (!fs.existsSync(storage)) {
            fs.mkdirSync(storage);
        }
        const folderList = fs.readdirSync(storage).filter(item => fs.statSync(path.join(storage, item)).isDirectory());
        res.status(200).json({ "message": "view-all", "data": folderList })
    }
    catch (err) {
        console.error('Error saving data:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/view/:name', async (req, res) => {
    const name = req.params.name
    if (!name) {
        return res.status(400).json({ "message": "Bad Request: invalid name" })
    }

    if (!fs.existsSync(storage)) {
        fs.mkdirSync(storage);
    }

    const dataFolderPath = path.join(storage, name)

    if (!fs.existsSync(dataFolderPath)) {
        return res.status(404).json({ "message": "Folder not found" });
    }

    const files = fs.readdirSync(dataFolderPath);

    const profile = files.find(file => file.startsWith('profile.'));

    let profileFilePath;
    let profileData: Buffer | undefined = undefined;
    let profileMimeType: string | undefined = undefined;

    if (profile) {
        profileFilePath = path.join(dataFolderPath, profile);
        profileData = fs.readFileSync(profileFilePath);
        profileMimeType = profile.split('.')[profile.split('.').length-1]
    }

    const cover = files.find(file => file.startsWith('cover.'));

    let coverFilePath;
    let coverData: Buffer | undefined = undefined;
    let coverMimeType: string | undefined = undefined; 

    if (cover) {
        coverFilePath = path.join(dataFolderPath, cover);
        coverData = fs.readFileSync(coverFilePath);
        coverMimeType = cover.split('.')[cover.split('.').length-1]
    }

    const jsonFilePath = path.join(dataFolderPath, 'data.json');
    if (!fs.existsSync(jsonFilePath)) {
        return res.status(404).json({ "message": "JSON file not found" });
    }

    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');

    const parsedJsonData = JSON.parse(jsonData);

    res.status(200).json({
        profile: profileData ? "data:image/"+profileMimeType+";base64,"+profileData.toString('base64') : "",
        cover: coverData ? "data:image/"+coverMimeType+";base64,"+coverData.toString('base64') : "",
        data: parsedJsonData
    });
});

app.post('/save', async (req, res) => {
    if (!req.is('multipart/form-data')) {
        return res.status(400).send('Bad Request: Form data required');
    }
    const form = formidable({});

    try {
        const [fields, files] = await form.parse(req);
        if (!fields.data) {
            return res.status(400).send('Bad Request: Form missing data');
        }

        if (!fs.existsSync(storage)) {
            fs.mkdirSync(storage);
        }

        let jsonData = JSON.parse(JSON.parse(JSON.stringify(fields.data, null, 2))[0]);
        jsonData.create_date = new Date().toISOString()

        const dataFolderName = jsonData.firstname + "-" + jsonData.lastname + "-" + (new Date().toISOString()).split('T')[0] + "-" + new Date().getHours() + "-" + new Date().getMinutes() + "-" + new Date().getSeconds()
        const storePath = path.join(storage, dataFolderName)
        fs.mkdirSync(storePath)
        fs.writeFileSync(storePath + "/data.json", JSON.stringify(jsonData));

        if (files.profile) {
            const profile = files.profile;
            if (!profile[0].mimetype?.includes("image")) {
                return res.status(400).send('Bad Request: file is not image');
            }
            const profileMimeType = profile[0].mimetype.split("image/")[1]
            fs.copyFileSync(profile[0].filepath, storePath + "/profile." + profileMimeType);
        }

        if (files.cover) {
            const cover = files.cover;
            if (!cover[0].mimetype?.includes("image")) {
                return res.status(400).send('Bad Request: file is not image');
            }
            const coverMimeType = cover[0].mimetype.split("image/")[1]
            fs.copyFileSync(cover[0].filepath, storePath + "/cover." + coverMimeType);
        }
    }
    catch (err) {
        console.error('Error saving data:', err);
        res.status(500).send('Internal Server Error');
    }

    res.status(200).json({ "message": "save success" })
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


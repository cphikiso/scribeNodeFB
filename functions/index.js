/* eslint-disable linebreak-style */
const functions = require("firebase-functions");
const {Configuration, OpenAIApi} = require("openai");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

/**
 * Download an audio file from a given storage URL.
 * @async
 * @function
 * @param {string} storageUrl - The URL of the audio file in Firebase Storage.
 * @return {Promise<string>} A promise that resolves to
 * the path of the downloaded audio file.
 */
async function downloadAudioFile(storageUrl) {
  const tempLocalFile = path.join(os.tmpdir(), "tempAudioFile.mp3");

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempLocalFile);
    https.get(storageUrl, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(tempLocalFile));
      });
    }).on("error", (error) => {
      fs.unlink(tempLocalFile, (err) => {
        if (err) {
          // eslint-disable-next-line max-len
          console.error(`Failed to delete temporary file: ${tempLocalFile}`, err);
        } else {
          console.log(`Temporary file deleted: ${tempLocalFile}`);
        }
      });
      reject(error);
    });
  });
}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

exports.callWhisper = functions.https.onRequest(async (req, res) => {
  try {
    const audioFile = req.body.prompt;
    const tempAudioFile = await downloadAudioFile(audioFile);
    const resp = await openai.createTranscription(
        fs.createReadStream(tempAudioFile), "whisper-1",
    );
    console.log("audio to text", resp.data);
    res.json(resp.data);
  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
});
exports.callDavinci = functions.https.onRequest(async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
    });
    console.log("text", completion.data.choices[0].text);
    res.json(completion.data);
  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
});



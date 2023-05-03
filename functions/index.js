/* eslint-disable linebreak-style */
const functions = require("firebase-functions");
const {Configuration, OpenAIApi} = require("openai");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");
const admin = require("firebase-admin");
const ffmpeg = require("fluent-ffmpeg");
const {Storage} = require("@google-cloud/storage");

admin.initializeApp();
const storage = new Storage();
const db = admin.firestore();
const bucketName = "scribe-speak-your-mind.appspot.com";

exports.convertAudioToMp3 = functions.https.onCall(async (data, context) => {
  const sourceFile = data.sourceFile;
  // eslint-disable-next-line max-len
  const targetFile = `${path.basename(sourceFile, path.extname(sourceFile))}.mp3`;

  const tempLocalSourceFile = path.join(os.tmpdir(), sourceFile);
  const tempLocalTargetFile = path.join(os.tmpdir(), targetFile);

  // Create the temporary directory if it doesn't exist
  fs.mkdirSync(path.dirname(tempLocalSourceFile), {recursive: true});

  // Download source file from Google Cloud Storage
  await storage.bucket(bucketName)
      .file(sourceFile).download({destination: tempLocalSourceFile});

  // Convert audio to MP3 format
  await new Promise((resolve, reject) => {
    ffmpeg(tempLocalSourceFile)
        .output(tempLocalTargetFile)
        .on("end", resolve)
        .on("error", reject)
        .run();
  });

  // Upload the converted audio file back to Google Cloud Storage
  await storage.bucket(bucketName)
      .upload(tempLocalTargetFile, {destination: targetFile});

  // Get the download URL of the converted file
  const uploadedFile = storage.bucket(bucketName).file(targetFile);
  const downloadURL = await uploadedFile.getSignedUrl({
    action: "read",
    expires: "03-09-2491",
  });

  // Clean up temporary files
  fs.unlinkSync(tempLocalSourceFile);
  fs.unlinkSync(tempLocalTargetFile);

  // Return the download URL of the converted audio file in Google Cloud Storage
  return downloadURL[0];
});


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


exports.getAllPostsSortedByTime = functions.https
    .onCall(async (data, context) => {
      const postsCollection = db.collectionGroup("userPosts");
      const allUserPosts = [];
      const afterTimestamp = data.afterTimestamp || null;

      // eslint-disable-next-line require-jsdoc
      async function getUserData(uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        return userDoc.data();
      }

      try {
        let q = postsCollection.orderBy("time", "desc");
        if (afterTimestamp) {
          const afterDate = new admin.firestore
              .Timestamp(afterTimestamp.seconds, afterTimestamp.nanoseconds);
          q = q.where("time", ">", afterDate);
        }
        const userPostsSnapshot = await q.get();

        for (const postDoc of userPostsSnapshot.docs) {
          const postData = postDoc.data();
          const postCreator = await getUserData(postData.uid);
          allUserPosts.push({id: postDoc.id, data: postData, postCreator});
        }

        return {success: true, data: allUserPosts};
      } catch (error) {
        console.error("Error getting posts: ", error);
        return {success: false, error: error.message};
      }
    });



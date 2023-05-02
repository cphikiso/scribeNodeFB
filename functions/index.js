/* eslint-disable linebreak-style */
const functions = require("firebase-functions");
const {Configuration, OpenAIApi} = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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





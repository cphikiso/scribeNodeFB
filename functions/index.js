const functions = require("firebase-functions");
const {Configuration, OpenAIApi} = require("openai");

const configuration = new Configuration({
  apiKey: "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",
});

const openai = new OpenAIApi(configuration);

exports.callDavinci = functions.https.onRequest(async (req, res) => {
  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: "Hello world",
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


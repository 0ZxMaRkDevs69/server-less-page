const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const { Configuration, OpenAIApi } = require('openai');

// Set up OpenAI configuration
const configuration = new Configuration({
  apiKey: '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', // replace with your actual API key
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(bodyParser.json());

// Your Facebook Page Access Token and Verify Token
const PAGE_ACCESS_TOKEN = 'EAAE5qEz4d3wBO3ZCDTL8DkQRtfiAHBTyAC6KriyvtRiRPj40oJKw8Teh1lqdqSTCy5BLikzHwf8AZAtZCfRAVpcT37iZAXBHcrNCvXDdZBvCRXOhCWqsnY4pT3kThvZAEePkG2ZBqJXrSZBwCpODZBqgYSllboSUmoAas74IEgZBxyTeJZBN6Y6JZCKvZB3t7fBMqjwZBi9AZDZD';  // replace with your actual token
const VERIFY_TOKEN = 'Echo69';

// Message history map to track conversations
const messageHistory = new Map();

// Webhook setup to verify the token
app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook to receive messages
app.post('/webhook', async (req, res) => {
  let body = req.body;

  // Check if the event is from a page subscription
  if (body.object === 'page') {
    body.entry.forEach(async function (entry) {
      let webhookEvent = entry.messaging[0];
      let senderId = webhookEvent.sender.id;

      // Check if the message contains text
      if (webhookEvent.message && webhookEvent.message.text) {
        let messageText = webhookEvent.message.text;
        console.log('Received message: ' + messageText);

        // Process the message using GPT-4
        let responseMessage = await processMessage(senderId, messageText);
        
        // Send the response back to the user
        sendMessage(senderId, responseMessage);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Process user messages and respond with GPT-4
async function processMessage(senderId, messageText) {
  try {
    let userHistory = messageHistory.get(senderId) || [];
    
    // Initialize conversation history if empty
    if (userHistory.length === 0) {
      userHistory.push({ role: 'system', content: 'You are a helpful assistant.' });
    }
    
    userHistory.push({ role: 'user', content: messageText });

    // Call OpenAI GPT-4 API
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: userHistory,
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
    });

    // Get GPT-4 response message
    const responseMessage = response.data.choices[0].message.content;

    // Add assistant's response to the conversation history
    userHistory.push({ role: 'assistant', content: responseMessage });
    
    // Save user history
    messageHistory.set(senderId, userHistory);

    return responseMessage;
  } catch (error) {
    console.error('Error with GPT-4:', error.message);
    return "I'm currently unable to process your request. Please try again later.";
  }
}

// Function to send message back to Facebook user
function sendMessage(senderId, responseMessage) {
  let requestBody = {
    recipient: {
      id: senderId,
    },
    message: {
      text: responseMessage,
    },
  };

  // Send HTTP request to Facebook's API
  request({
    uri: 'https://graph.facebook.com/v16.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, res, body) => {
    if (!err) {
      console.log('Message sent!');
    } else {
      console.error('Error sending message: ' + err);
    }
  });
}

// Start the server
const PORT = process.env.PORT || 1337;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

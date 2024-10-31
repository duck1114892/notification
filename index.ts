const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");
const {
  Novu,
  TemplateVariableTypeEnum,
  FilterPartTypeEnum,
  PushProviderIdEnum,
  StepTypeEnum,
} = require("@novu/node");
const webPush = require('web-push');
require('dotenv').config(); // Load environment variables

const app = express();
const port = 8080;

app.use(cors());
app.use(bodyParser.json());

// Khởi tạo VAPID keys
const vapidKeys = webPush.generateVAPIDKeys();

console.log('Public VAPID Key:', vapidKeys.publicKey);
console.log('Private VAPID Key:', vapidKeys.privateKey);

// Khởi tạo Novu với SECRET_KEY từ .env
const novu = new Novu(process.env.NOVU_SECRET);
const hmacSecret = process.env.HMAC_SECRET; // HMAC secret từ .env

app.post('/api/webhook', async (req, res) => {
  const signature = req.headers['x-novu-signature'];
  const hmac = crypto.createHmac('sha256', hmacSecret).update(JSON.stringify(req.body)).digest('hex');

  // Kiểm tra HMAC
  if (signature !== hmac) {
    return res.status(401).send('Invalid signature');
  }

  const { target, title, content } = req.body; // Lấy dữ liệu từ webhook
  console.log('Received webhook:', req.body);

  const payload = JSON.stringify({
      title: title,
      content: content
  });

  const options = {
      vapidDetails: {
          subject: process.env.VAPID_SUBJECT,
          publicKey: vapidKeys.publicKey,
          privateKey: vapidKeys.privateKey,
      },
      TTL: 60,
  };

  // Gửi thông báo đến từng target (device token)
  target.forEach(async (token) => {
      await webPush.sendNotification(token, payload, options)
          .catch(error => console.error('Error sending notification', error));
  });

  res.status(200).send('Webhook processed');
});

// Đăng ký subscriber
app.post('/api/register-subscriber', async (req, res) => {
    const { subscriberId, deviceTokens } = req.body;
    try {
        const data = await novu.subscribers.setCredentials(
            subscriberId,
            PushProviderIdEnum.PushWebhook,
            { deviceTokens: [deviceTokens] },
        );
        res.status(200).json({ message: 'Subscriber registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Gửi thông báo
app.post('/api/send-notification', async (req, res) => {
  const { subscriberId, payload } = req.body;
  try {
    const response = await novu.trigger('onboarding-workflow', {
      to: {
        subscriberId: subscriberId,
      },
      payload: payload || {},
    });
    res.status(200).json({ message: 'Notification sent', notificationId: response.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

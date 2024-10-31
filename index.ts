const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const {
  Novu,
  TemplateVariableTypeEnum,
  FilterPartTypeEnum,
  PushProviderIdEnum,
  StepTypeEnum,
} = require("@novu/node");
const webPush = require('web-push');

// Tạo cặp VAPID keys


const app = express();
const port = 8080;

app.use(cors());
app.use(bodyParser.json());
const vapidKeys = webPush.generateVAPIDKeys();

console.log('Public VAPID Key:', vapidKeys.publicKey);
console.log('Private VAPID Key:', vapidKeys.privateKey);

// Khởi tạo Novu với SECRET_KEY
const novu = new Novu("f4d3c0c2ba028743b20e329ca292fc86");
app.post('/api/webhook', async (req, res) => {
  const { target, title, content } = req.body; // Lấy dữ liệu từ webhook
  console.log('Received webhook:', req.body);

  // Ở đây, bạn có thể gửi thông báo đến client bằng web-push
  const payload = JSON.stringify({
      title: title,
      content: content
  });

  const options = {
      vapidDetails: {
          subject: 'mailto:your-email@example.com',
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

// API endpoint để tạo workflow
app.post("/api/workflow", async (req, res) => {
  try {
    const { data: workflowGroupsData } = await novu.notificationGroups.get();

    // Create a new workflow
    await novu.notificationTemplates.create({
      name: 'Onboarding Workflow',
      notificationGroupId: workflowGroupsData.data[0]._id,
      steps: [
        {
          active: true,
          shouldStopOnFail: false,
          uuid: '78ab8c72-46de-49e4-8464-257085960f9e',
          name: 'Chat',
          filters: [
            {
              value: 'AND',
              children: [
                {
                  field: '{{chatContent}}',
                  value: 'flag',
                  operator: 'NOT_IN',
                  on: FilterPartTypeEnum.PAYLOAD,
                },
              ],
            },
          ],
          template: {
            type: StepTypeEnum.CHAT,
            active: true,
            subject: '',
            variables: [
              {
                name: 'chatContent',
                type: TemplateVariableTypeEnum.STRING,
                required: true,
              },
            ],
            content: '{{chatContent}}',
            contentType: 'editor',
          },
        },
      ],
      description: 'Onboarding workflow to trigger after user sign up',
      active: true,
      draft: false,
      critical: false,
    });

    res.status(201).json({ message: 'Workflow created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Đăng ký subscriber

  app.post('/api/register-subscriber', async (req, res) => {
    const { subscriberId, deviceTokens } = req.body;
    console.log(deviceTokens )
  const data =  await novu.subscribers.setCredentials(
      subscriberId,
      PushProviderIdEnum.PushWebhook,
      { deviceTokens: [deviceTokens] },
      )
    })


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
    console.log(response);
    res.status(200).json({ message: 'Notification sent', notificationId: response.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Khởi động server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

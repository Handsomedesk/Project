// 웹 푸시 사용시 (푸시 알림 API)
/*
// push.js

const webpush = require('web-push');

// VAPID keys should only be generated once.
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  'mailto:example@yourdomain.org',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const sendPushNotification = (subscription, data) => {
  webpush.sendNotification(subscription, JSON.stringify(data))
    .then(response => console.log('Push notification sent:', response))
    .catch(error => console.error('Error sending push notification:', error));
};

module.exports = {
  sendPushNotification,
  vapidKeys
};
*/
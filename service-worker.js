// 웹 푸시 사용시 (서비스 워커)
// service-worker.js
self.addEventListener('push', function(event) {
    const data = event.data.json();
    const title = data.title;
    const options = {
      body: data.body,
      icon: '/path/to/icon.png'
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });
  
// 크롬이 이 사이트를 "설치 가능한 앱"으로 인정하게 하는 최소 파일. 아무것도 저장(캐시)하지 않고 그대로 인터넷에서 받는다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* 기본 동작(인터넷에서 받기) 그대로 */ });

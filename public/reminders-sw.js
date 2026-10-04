self.addEventListener('push',event=>{
 // No medication name, dose, diagnosis, or other health data on the lock screen.
 let language='pl';try{language=event.data.json().locale==='en'?'en':'pl';}catch{}
 event.waitUntil(self.registration.showNotification('Side Effects Her',{body:language==='en'?'You have a reminder in your daily plan. Open the app to review it.':'Masz przypomnienie w swoim planie dnia. Otwórz aplikację, żeby je sprawdzić.',tag:'sideeffecther-daily',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const tab=windows.find(w=>new URL(w.url).origin===self.location.origin);if(tab){await tab.focus();return tab.navigate('/');}return clients.openWindow('/');}));
});

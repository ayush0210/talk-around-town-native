import PushNotification from 'react-native-push-notification';

const LocalNotification = () => {
    const key = Date.now().toString(); // Key must be unique everytime
    PushNotification.createChannel(
        {
            channelId: key, // (required)
            channelName: 'Sample push notification', // (required)
            channelDescription: "You've arrived at Publix! Let's promote some language well-being.", // (optional) default: undefined.
            importance: 4, // (optional) default: 4. Int value of the Android notification importance
            vibrate: true, // (optional) default: true. Creates the default vibration patten if true.
        },
        (created) => console.log(`createChannel returned '${created}'`) // (optional) callback returns whether the channel was created, false means it already existed.
    );
    PushNotification.localNotification({
        channelId: key, //this must be same with channelid in createchannel
        title: 'Sample push notification',
        message: 'You\'ve arrived at Publix! Let\'s promote some language well-being.',
    });
    console.log('Local Notification');
};

export default LocalNotification;

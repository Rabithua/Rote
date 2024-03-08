// webpush PWA消息推送
import webpush from "web-push";

const apiKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY as string,
  privateKey: process.env.VAPID_PRIVATE_KEY as string,
};

webpush.setVapidDetails(
  "mailto:rabit.hua@gmail.com",
  apiKeys.publicKey,
  apiKeys.privateKey
);

export default webpush;

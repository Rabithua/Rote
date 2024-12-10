// Web Push notification service for PWA
import webpush from "web-push";

const apiKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY as string,
  privateKey: process.env.VAPID_PRIVATE_KEY as string,
};

if (!apiKeys.publicKey || !apiKeys.privateKey) {
  console.info("VAPID keys are not provided");
} else {
  webpush.setVapidDetails(
    "mailto:rabit.hua@gmail.com",
    apiKeys.publicKey,
    apiKeys.privateKey
  );
}

export default apiKeys.publicKey && apiKeys.privateKey ? webpush : null;

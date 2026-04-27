package com.chat2goo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Vibrator;
import android.os.VibrationEffect;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import android.util.Log;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class ChatFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "ChatFCM";
    private static final String CHANNEL_ID_PREFIX = "chat_messages_v3_";
    private static final String CHANNEL_NAME = "Pesan Chat";
    private static final String CALL_CHANNEL_ID = "incoming_calls_v1";
    private static final String CALL_CHANNEL_NAME = "Panggilan Masuk";

    private static MediaPlayer callRingtonePlayer = null;
    private static Vibrator vibrator = null;
    private static PowerManager.WakeLock callWakeLock = null;

    // Deduplication: track last notification to prevent duplicates
    private static String lastNotifKey = "";
    private static long lastNotifTime = 0;
    private static final long DEDUP_INTERVAL_MS = 5000; // 5 seconds

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        // Save token to Supabase
        saveTokenToSupabase(token);
    }

    private void saveTokenToSupabase(String token) {
        new Thread(() -> {
            try {
                // Get current user email from Capacitor Preferences
                android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
                String email = prefs.getString("user_email", "");
                if (email.isEmpty()) {
                    Log.w(TAG, "No user email saved, cannot save FCM token");
                    return;
                }

                String supabaseUrl = "https://gpcduahypyynjlcgodnl.supabase.co";
                String supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwY2R1YWh5cHl5bmpsY2dvZG5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNjQ1OCwiZXhwIjoyMDkyNjAyNDU4fQ.0lGZqPqXQ0pV0qJ0qJ0qJ0qJ0qJ0qJ0qJ0qJ0qJ0qJ0";

                java.net.URL url = new java.net.URL(supabaseUrl + "/rest/v1/users?email=eq." + java.net.URLEncoder.encode(email, "UTF-8"));
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);

                String jsonBody = "{\"fcm_token\":\"" + token + "\"}";
                java.io.OutputStream os = conn.getOutputStream();
                os.write(jsonBody.getBytes("UTF-8"));
                os.close();

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Token saved to Supabase, response: " + responseCode);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to save FCM token: " + e.getMessage());
            }
        }).start();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // Do NOT call super - we handle everything ourselves
        // super.onMessageReceived would forward to Capacitor which creates duplicate notifications

        Log.d(TAG, "=== onMessageReceived START ===");
        Log.d(TAG, "From: " + remoteMessage.getFrom());
        Log.d(TAG, "Data size: " + remoteMessage.getData().size());
        Log.d(TAG, "Has notification: " + (remoteMessage.getNotification() != null));
        Log.d(TAG, "Data: " + remoteMessage.getData().toString());

        // Wake up screen when screen is off
        wakeUpScreen();

        String msgType = remoteMessage.getData().get("msg_type");
        boolean isCall = "call".equals(msgType);

        String title = "";
        String body = "";
        String conversationId = "";
        String senderAvatar = "";
        String callId = "";
        String calleeEmail = "";

        // Extract data payload
        if (remoteMessage.getData().size() > 0) {
            title = remoteMessage.getData().get("sender_name");
            body = remoteMessage.getData().get("message_body");
            if (body == null || body.isEmpty()) {
                body = remoteMessage.getData().get("msg_type") != null
                    ? formatBody(remoteMessage.getData().get("msg_type"), remoteMessage.getData().get("body"))
                    : "";
            }
            conversationId = remoteMessage.getData().get("conversation_id");
            senderAvatar = remoteMessage.getData().get("sender_avatar");
            callId = remoteMessage.getData().get("call_id");
            calleeEmail = remoteMessage.getData().get("callee_email");
        }

        // Fallback to notification payload if data is empty
        if (title == null || title.isEmpty()) {
            if (remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
                body = remoteMessage.getNotification().getBody();
            }
        }

        if (title == null) title = "Chat2goo";
        if (body == null) body = "Pesan baru";

        // Deduplication: skip if same notification arrived within 5 seconds (but not for calls)
        String notifKey = conversationId + ":" + title + ":" + body + ":" + callId;
        long now = System.currentTimeMillis();
        if (!isCall && notifKey.equals(lastNotifKey) && (now - lastNotifTime) < DEDUP_INTERVAL_MS) {
            Log.w(TAG, "Duplicate notification skipped: " + notifKey);
            return;
        }
        lastNotifKey = notifKey;
        lastNotifTime = now;

        Log.d(TAG, "Title: " + title + ", Body: " + body + ", Avatar: " + senderAvatar + ", IsCall: " + isCall);

        // Make final copies for lambda
        final String finalTitle = title;
        final String finalBody = body;
        final String finalConversationId = conversationId;
        final String finalSenderAvatar = senderAvatar;
        final String finalCallId = callId;
        final String finalCalleeEmail = calleeEmail;

        if (isCall) {
            // Check if app is in foreground
            android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            boolean isAppForeground = false;
            if (am != null) {
                java.util.List<android.app.ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
                if (processes != null) {
                    for (android.app.ActivityManager.RunningAppProcessInfo process : processes) {
                        if (process.processName.equals(getPackageName()) && process.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                            isAppForeground = true;
                            break;
                        }
                    }
                }
            }
            Log.d(TAG, "App in foreground: " + isAppForeground);

            if (isAppForeground) {
                // App is in foreground - CallScreen will handle the UI
                // Don't play ringtone or show notification to avoid double ringing
                Log.d(TAG, "App foreground, skipping call notification (CallScreen handles it)");
                return;
            }

            // App is in background - show call notification with ringtone
            stopCallRingtone(); // Stop any previous ringing
            acquireCallWakeLock();
            wakeUpScreen();

            // Show notification immediately without avatar, then update with avatar
            showCallNotification(finalTitle, finalBody, finalConversationId, finalCallId, finalCalleeEmail, null);
            startCallRingtone();

            // Download avatar and update notification
            if (finalSenderAvatar != null && !finalSenderAvatar.isEmpty()) {
                new Thread(() -> {
                    Bitmap avatar = downloadBitmap(finalSenderAvatar);
                    if (avatar != null) {
                        Log.d(TAG, "Avatar downloaded, updating notification");
                        showCallNotification(finalTitle, finalBody, finalConversationId, finalCallId, finalCalleeEmail, avatar);
                    }
                }).start();
            }
        } else {
            // Download avatar and show notification
            if (finalSenderAvatar != null && !finalSenderAvatar.isEmpty()) {
                new Thread(() -> {
                    Bitmap avatar = downloadBitmap(finalSenderAvatar);
                    Log.d(TAG, "Avatar downloaded: " + (avatar != null));
                    showNotification(finalTitle, finalBody, finalConversationId, avatar);
                }).start();
            } else {
                showNotification(finalTitle, finalBody, finalConversationId, null);
            }
        }
    }

    private String formatBody(String messageType, String bodyText) {
        if (messageType == null) return bodyText != null ? bodyText : "Pesan baru";
        switch (messageType) {
            case "image": return "📷 Foto";
            case "file": return "📎 File";
            default: return bodyText != null ? bodyText : "Pesan baru";
        }
    }

    private void showNotification(String title, String body, String conversationId, Bitmap avatar) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("PUSH_NOTIFICATION_TAP");
        if (conversationId != null && !conversationId.isEmpty()) {
            intent.putExtra("conversation_id", conversationId);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) System.currentTimeMillis(),
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Read notification preferences from CapacitorStorage
        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        // Capacitor Preferences stores all values as Strings, so read as String and convert
        boolean soundEnabled = "true".equals(prefs.getString("notif_sound_enabled", "true"));
        boolean vibrationEnabled = "true".equals(prefs.getString("notif_vibration_enabled", "true"));
        String selectedSound = prefs.getString("notif_selected_sound", "notif");

        // Resolve sound URI based on selection
        Uri soundUri = null;
        if (soundEnabled && !"silent".equals(selectedSound)) {
            int soundResId = getSoundResId(selectedSound);
            if (soundResId != 0) {
                soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
            }
        }

        // Build channel ID based on sound selection so channel is recreated when sound changes
        String channelId = CHANNEL_ID_PREFIX + (soundEnabled ? selectedSound : "silent");

        // Ensure channel exists with correct sound
        createNotificationChannel(channelId, soundUri, vibrationEnabled);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setOnlyAlertOnce(false);

        // Apply sound
        if (soundUri != null) {
            builder.setSound(soundUri);
        } else {
            builder.setSound(null);
        }

        // Apply vibration
        if (vibrationEnabled) {
            builder.setVibrate(new long[]{0, 300, 200, 300});
        } else {
            builder.setVibrate(new long[]{});
        }

        // Add avatar as large icon (circular crop like WhatsApp)
        if (avatar != null) {
            Bitmap circularAvatar = getCircularBitmap(avatar);
            builder.setLargeIcon(circularAvatar);
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);

        // Check if notifications are enabled
        boolean areEnabled = notificationManager.areNotificationsEnabled();
        Log.d(TAG, "Notifications enabled: " + areEnabled);

        if (areEnabled) {
            notificationManager.notify((int) System.currentTimeMillis(), builder.build());
            Log.d(TAG, "Notification shown!");
        } else {
            Log.e(TAG, "Notifications NOT enabled - cannot show!");
        }
    }

    private void showCallNotification(String title, String body, String conversationId, String callId, String calleeEmail, Bitmap avatar) {
        // Intent to open app with INCOMING_CALL - shows CallScreen UI
        Intent callIntent = new Intent(this, MainActivity.class);
        callIntent.setAction("INCOMING_CALL");
        callIntent.putExtra("call_id", callId);
        callIntent.putExtra("conversation_id", conversationId);
        callIntent.putExtra("callee_email", calleeEmail);
        callIntent.putExtra("sender_name", title);
        callIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent callPendingIntent = PendingIntent.getActivity(
            this,
            100,
            callIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Create call notification channel
        createCallNotificationChannel();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(title)
            .setContentText("Panggilan masuk")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(false)
            .setOngoing(true)
            .setFullScreenIntent(callPendingIntent, true)
            .setContentIntent(callPendingIntent)
            .setOnlyAlertOnce(false)
            .setSound(null)
            .setVibrate(new long[]{});

        // Add avatar as large icon
        if (avatar != null) {
            Bitmap circularAvatar = getCircularBitmap(avatar);
            builder.setLargeIcon(circularAvatar);
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);

        if (notificationManager.areNotificationsEnabled()) {
            // Use a fixed ID for call notification so it can be cancelled later
            notificationManager.notify(9999, builder.build());
            Log.d(TAG, "Call notification shown!");
        } else {
            Log.e(TAG, "Notifications NOT enabled - cannot show call notification!");
        }
    }

    private void createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID,
                CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifikasi panggilan masuk");
            channel.enableLights(true);
            channel.enableVibration(false);
            channel.setSound(null, null);
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);

            manager.createNotificationChannel(channel);
        }
    }

    private void startCallRingtone() {
        try {
            // Play default ringtone
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            callRingtonePlayer = new MediaPlayer();
            callRingtonePlayer.setDataSource(this, ringtoneUri);
            callRingtonePlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build());
            callRingtonePlayer.setLooping(true);
            callRingtonePlayer.prepare();
            callRingtonePlayer.start();
            Log.d(TAG, "Call ringtone started");

            // Start vibration pattern
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 500, 200, 500, 200, 500, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to play call ringtone: " + e.getMessage());
        }
    }

    public static void stopCallRingtone() {
        try {
            if (callRingtonePlayer != null) {
                if (callRingtonePlayer.isPlaying()) {
                    callRingtonePlayer.stop();
                }
                callRingtonePlayer.release();
                callRingtonePlayer = null;
                Log.d("ChatFCM", "Call ringtone stopped");
            }
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
            }
        } catch (Exception e) {
            Log.e("ChatFCM", "Failed to stop call ringtone: " + e.getMessage());
        }
    }

    public static void cancelCallNotification(Context context) {
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.cancel(9999);
            Log.d("ChatFCM", "Call notification cancelled");
        } catch (Exception e) {
            Log.e("ChatFCM", "Failed to cancel call notification: " + e.getMessage());
        }
        stopCallRingtone();
        releaseCallWakeLock();
    }

    private void acquireCallWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                callWakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Chat2goo::CallWakeLock"
                );
                callWakeLock.acquire(60000L); // 60 seconds max
                Log.d(TAG, "Call wake lock acquired");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire call wake lock: " + e.getMessage());
        }
    }

    public static void releaseCallWakeLock() {
        try {
            if (callWakeLock != null && callWakeLock.isHeld()) {
                callWakeLock.release();
                callWakeLock = null;
                Log.d("ChatFCM", "Call wake lock released");
            }
        } catch (Exception e) {
            Log.e("ChatFCM", "Failed to release call wake lock: " + e.getMessage());
        }
    }

    private Bitmap downloadBitmap(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.connect();
            InputStream input = connection.getInputStream();
            Bitmap bitmap = BitmapFactory.decodeStream(input);
            input.close();
            connection.disconnect();
            return bitmap;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private Bitmap getCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) return null;

        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        int x = (bitmap.getWidth() - size) / 2;
        int y = (bitmap.getHeight() - size) / 2;

        Bitmap squared = Bitmap.createBitmap(bitmap, x, y, size, size);

        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);

        android.graphics.Paint paint = new android.graphics.Paint();
        paint.setAntiAlias(true);

        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(squared, 0, 0, paint);

        return output;
    }

    private void wakeUpScreen() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && !powerManager.isInteractive()) {
                PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "Chat2goo::NotificationWakeLock"
                );
                wakeLock.acquire(10000L); // 10 seconds to give enough time for screen to wake
                // Don't release immediately - let it auto-release after timeout
                new Thread(() -> {
                    try { Thread.sleep(10000); } catch (InterruptedException e) {}
                    if (wakeLock.isHeld()) wakeLock.release();
                }).start();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to wake up screen: " + e.getMessage());
        }
    }

    private int getSoundResId(String soundName) {
        switch (soundName) {
            case "chime":
                return R.raw.chime;
            case "alert":
                return R.raw.alert;
            case "notif":
            default:
                return R.raw.notif;
        }
    }

    private void createNotificationChannel(String channelId, Uri soundUri, boolean vibrationEnabled) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Delete old channels from previous versions
            manager.deleteNotificationChannel("messages_notif_v1");
            manager.deleteNotificationChannel("chat_messages_v3");

            // Delete stale channel variants (different sound selection)
            // This ensures the channel is recreated with the correct sound
            String[] possibleSounds = {"notif", "chime", "alert", "silent"};
            for (String s : possibleSounds) {
                String oldId = CHANNEL_ID_PREFIX + s;
                if (!oldId.equals(channelId)) {
                    manager.deleteNotificationChannel(oldId);
                }
            }

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();

            NotificationChannel channel = new NotificationChannel(
                channelId,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifikasi pesan chat");
            channel.enableLights(true);
            channel.enableVibration(vibrationEnabled);
            if (vibrationEnabled) {
                channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            } else {
                channel.setVibrationPattern(new long[]{});
            }
            if (soundUri != null) {
                channel.setSound(soundUri, audioAttributes);
            } else {
                channel.setSound(null, null);
            }
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            manager.createNotificationChannel(channel);
        }
    }
}

package com.chat2goo.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveToGalleryPlugin.class);
        registerPlugin(MoveToBackgroundPlugin.class);
        registerPlugin(CallNotificationPlugin.class);
        super.onCreate(savedInstanceState);

        // Check if launched from call notification (full-screen intent)
        handleIncomingCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Check if resumed from call notification
        handleIncomingCallIntent(intent);
    }

    private void handleIncomingCallIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "handleIncomingCallIntent: action=" + action);

        if ("INCOMING_CALL".equals(action)) {
            String callId = intent.getStringExtra("call_id");
            String conversationId = intent.getStringExtra("conversation_id");
            String calleeEmail = intent.getStringExtra("callee_email");
            String senderName = intent.getStringExtra("sender_name");

            Log.d(TAG, "Incoming call intent: callId=" + callId + ", sender=" + senderName);

            // Don't cancel notification here - let ringtone keep playing until user answers/rejects
            // CallScreen will stop ringtone when user interacts

            // Store in SharedPreferences so JS can read it
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("pending_call_id", callId != null ? callId : "");
            editor.putString("pending_call_conversation_id", conversationId != null ? conversationId : "");
            editor.putString("pending_call_callee_email", calleeEmail != null ? calleeEmail : "");
            editor.putString("pending_call_sender_name", senderName != null ? senderName : "");
            editor.putBoolean("has_pending_call", true);
            editor.apply();
        }
    }
}

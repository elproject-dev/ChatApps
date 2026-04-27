package com.chat2goo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class CallDismissReceiver extends BroadcastReceiver {
    private static final String TAG = "CallDismissReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);

        if ("DISMISS_CALL".equals(action) || "REJECT_CALL".equals(action)) {
            String callId = intent.getStringExtra("call_id");
            Log.d(TAG, "Call rejected/dismissed, call_id: " + callId);

            // Stop ringtone and vibration, cancel notification, release wake lock
            ChatFirebaseMessagingService.cancelCallNotification(context);

            // Save rejected call info to SharedPreferences so JS can handle it with auth
            if (callId != null && !callId.isEmpty()) {
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("rejected_call_id", callId);
                editor.putBoolean("has_rejected_call", true);
                editor.apply();
                Log.d(TAG, "Saved rejected call to SharedPreferences: " + callId);
            }
        }
    }
}

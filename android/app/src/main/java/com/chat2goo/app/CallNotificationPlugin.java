package com.chat2goo.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallNotification")
public class CallNotificationPlugin extends Plugin {
    private static final String TAG = "CallNotificationPlugin";

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        try {
            Log.d(TAG, "Stopping call ringtone via plugin");
            ChatFirebaseMessagingService.stopCallRingtone();
            ChatFirebaseMessagingService.cancelCallNotification(getContext());
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop ringtone: " + e.getMessage());
            call.reject("Failed to stop ringtone: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingCall(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            boolean hasPendingCall = prefs.getBoolean("has_pending_call", false);

            JSObject result = new JSObject();
            result.put("hasPendingCall", hasPendingCall);

            if (hasPendingCall) {
                result.put("callId", prefs.getString("pending_call_id", ""));
                result.put("conversationId", prefs.getString("pending_call_conversation_id", ""));
                result.put("calleeEmail", prefs.getString("pending_call_callee_email", ""));
                result.put("senderName", prefs.getString("pending_call_sender_name", ""));

                // Clear pending call data
                SharedPreferences.Editor editor = prefs.edit();
                editor.remove("has_pending_call");
                editor.remove("pending_call_id");
                editor.remove("pending_call_conversation_id");
                editor.remove("pending_call_callee_email");
                editor.remove("pending_call_sender_name");
                editor.apply();

                Log.d(TAG, "Returning pending call: callId=" + result.getString("callId"));
            }

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get pending call: " + e.getMessage());
            call.reject("Failed to get pending call: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getShouldAutoAnswer(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            boolean shouldAutoAnswer = prefs.getBoolean("should_auto_answer", false);

            JSObject result = new JSObject();
            result.put("shouldAutoAnswer", shouldAutoAnswer);

            // Clear the flag after reading
            if (shouldAutoAnswer) {
                SharedPreferences.Editor editor = prefs.edit();
                editor.remove("should_auto_answer");
                editor.apply();
                Log.d(TAG, "Auto answer flag read and cleared");
            }

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get auto answer flag: " + e.getMessage());
            call.reject("Failed to get auto answer flag: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getShouldAutoReject(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            boolean shouldAutoReject = prefs.getBoolean("should_auto_reject", false);

            JSObject result = new JSObject();
            result.put("shouldAutoReject", shouldAutoReject);

            if (shouldAutoReject) {
                result.put("callId", prefs.getString("rejected_call_id", ""));

                // Clear the flags after reading
                SharedPreferences.Editor editor = prefs.edit();
                editor.remove("should_auto_reject");
                editor.remove("rejected_call_id");
                editor.apply();
                Log.d(TAG, "Auto reject flag read and cleared, callId=" + result.getString("callId"));
            }

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get auto reject flag: " + e.getMessage());
            call.reject("Failed to get auto reject flag: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRejectedCall(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            boolean hasRejectedCall = prefs.getBoolean("has_rejected_call", false);

            JSObject result = new JSObject();
            result.put("hasRejectedCall", hasRejectedCall);

            if (hasRejectedCall) {
                result.put("callId", prefs.getString("rejected_call_id", ""));

                // Clear rejected call data
                SharedPreferences.Editor editor = prefs.edit();
                editor.remove("has_rejected_call");
                editor.remove("rejected_call_id");
                editor.apply();

                Log.d(TAG, "Returning rejected call: callId=" + result.getString("callId"));
            }

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get rejected call: " + e.getMessage());
            call.reject("Failed to get rejected call: " + e.getMessage());
        }
    }
}

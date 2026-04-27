package com.chat2goo.app;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MoveToBackground")
public class MoveToBackgroundPlugin extends Plugin {

    @PluginMethod
    public void moveToBackground(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                activity.moveTaskToBack(true);
            });
        }
        call.resolve();
    }
}

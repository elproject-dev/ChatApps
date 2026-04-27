package com.chat2goo.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.HttpURLConnection;

@CapacitorPlugin(name = "SaveToGallery")
public class SaveToGalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String fileUrl = call.getString("url");
        if (fileUrl == null || fileUrl.isEmpty()) {
            call.reject("No URL provided");
            return;
        }

        String fileName = call.getString("fileName", "chat_image_" + System.currentTimeMillis() + ".jpg");

        // Run network + IO on background thread to avoid NetworkOnMainThread crash
        new Thread(() -> {
            try {
                // Download image on background thread
                URL url = new URL(fileUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setRequestMethod("GET");
                connection.setDoInput(true);
                connection.connect();

                InputStream inputStream = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();
                connection.disconnect();

                if (bitmap == null) {
                    call.reject("Failed to decode image");
                    return;
                }

                // Save to gallery using MediaStore
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();

                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Chat2goo");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                }

                Uri imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

                if (imageUri == null) {
                    call.reject("Failed to create MediaStore entry");
                    return;
                }

                // Write image data
                OutputStream out = resolver.openOutputStream(imageUri);
                if (out != null) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out);
                    out.flush();
                    out.close();
                }

                // Clear IS_PENDING flag for Android 10+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues updateValues = new ContentValues();
                    updateValues.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(imageUri, updateValues, null, null);
                }

                bitmap.recycle();

                JSObject result = new JSObject();
                result.put("uri", imageUri.toString());
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Error saving image: " + e.getMessage());
            }
        }).start();
    }
}

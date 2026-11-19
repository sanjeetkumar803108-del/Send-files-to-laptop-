package com.hotspotdrop.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "HotSpotDropBridge";

    private static class OpenFileEntry {
        final OutputStream stream;
        final Uri mediaUri;
        final File legacyFile;
        final String displayName;

        OpenFileEntry(OutputStream stream, Uri mediaUri, File legacyFile, String displayName) {
            this.stream = stream;
            this.mediaUri = mediaUri;
            this.legacyFile = legacyFile;
            this.displayName = displayName;
        }
    }

    private final ConcurrentHashMap<String, OpenFileEntry> openFiles = new ConcurrentHashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                settings.setMediaPlaybackRequiresUserGesture(false);
                webView.addJavascriptInterface(new AndroidFileBridge(), "AndroidFileBridge");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error attaching AndroidFileBridge", e);
        }
    }

    @Override
    public void onDestroy() {
        for (String fileId : openFiles.keySet()) {
            closeAndCleanup(fileId, true);
        }
        super.onDestroy();
    }

    private void closeAndCleanup(String fileId, boolean deletePartial) {
        OpenFileEntry entry = openFiles.remove(fileId);
        if (entry == null) return;
        try {
            entry.stream.flush();
            entry.stream.close();
        } catch (Exception ignored) {}

        if (deletePartial) {
            try {
                if (entry.mediaUri != null) {
                    getContentResolver().delete(entry.mediaUri, null, null);
                } else if (entry.legacyFile != null && entry.legacyFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    entry.legacyFile.delete();
                }
            } catch (Exception ignored) {}
        }
    }

    private String sanitizeFileName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "file_" + System.currentTimeMillis();
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    public class AndroidFileBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void setKeepScreenOn(final boolean keepOn) {
            runOnUiThread(() -> {
                try {
                    if (keepOn) {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    } else {
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "setKeepScreenOn error", e);
                }
            });
        }

        @JavascriptInterface
        public boolean startFile(String fileId, String fileName, String mimeType) {
            try {
                closeAndCleanup(fileId, true);
                String safeName = sanitizeFileName(fileName);
                String safeMime = (mimeType != null && !mimeType.trim().isEmpty())
                        ? mimeType
                        : "application/octet-stream";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HotSpotDrop");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);

                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        Log.e(TAG, "Failed to create MediaStore entry for " + safeName);
                        return false;
                    }
                    OutputStream rawOs = resolver.openOutputStream(uri);
                    if (rawOs == null) {
                        resolver.delete(uri, null, null);
                        return false;
                    }
                    OutputStream buffered = new BufferedOutputStream(rawOs, 128 * 1024);
                    openFiles.put(fileId, new OpenFileEntry(buffered, uri, null, safeName));
                    return true;
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File appDir = new File(downloadsDir, "HotSpotDrop");
                    if (!appDir.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        appDir.mkdirs();
                    }
                    File outFile = new File(appDir, safeName);
                    int counter = 1;
                    while (outFile.exists()) {
                        int dotIdx = safeName.lastIndexOf('.');
                        String renamed = dotIdx > 0
                                ? safeName.substring(0, dotIdx) + "_" + counter + safeName.substring(dotIdx)
                                : safeName + "_" + counter;
                        outFile = new File(appDir, renamed);
                        counter++;
                    }
                    OutputStream buffered = new BufferedOutputStream(new FileOutputStream(outFile), 128 * 1024);
                    openFiles.put(fileId, new OpenFileEntry(buffered, null, outFile, outFile.getName()));
                    return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "startFile failed for " + fileName, e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean writeChunkBase64(String fileId, String base64Data) {
            OpenFileEntry entry = openFiles.get(fileId);
            if (entry == null) return false;
            try {
                byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);
                entry.stream.write(decoded);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "writeChunkBase64 failed for " + fileId, e);
                return false;
            }
        }

        @JavascriptInterface
        public String finishFile(String fileId) {
            OpenFileEntry entry = openFiles.remove(fileId);
            if (entry == null) return "";
            try {
                entry.stream.flush();
                entry.stream.close();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && entry.mediaUri != null) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(entry.mediaUri, values, null, null);
                }
                return "Downloads/HotSpotDrop/" + entry.displayName;
            } catch (Exception e) {
                Log.e(TAG, "finishFile failed for " + fileId, e);
                return "";
            }
        }

        @JavascriptInterface
        public void cancelFile(String fileId) {
            closeAndCleanup(fileId, true);
        }
    }
}

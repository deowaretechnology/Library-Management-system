package com.deoware.collegelibrary;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebView webView = this.bridge.getWebView();

        // Fixes a well-known Android WebView bug: a getUserMedia() camera
        // stream (used here by the QR scanner) starts fine — no JS error,
        // no permission error — but renders as a plain black rectangle
        // instead of the actual video, because the WebView's default
        // hardware-accelerated compositing doesn't correctly paint the
        // camera's video surface. Forcing the WebView onto a hardware
        // layer makes it actually draw the frames.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // A plain WebView silently ignores file downloads (reports, exports,
        // QR images). Hand http(s) downloads to the system DownloadManager,
        // forwarding the session cookie so authenticated routes work.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null) {
                return;
            }
            if (url.startsWith("data:") || url.startsWith("blob:")) {
                Toast.makeText(MainActivity.this, "Long-press the image to save it", Toast.LENGTH_LONG).show();
                return;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                return;
            }
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }
                if (userAgent != null) {
                    request.addRequestHeader("User-Agent", userAgent);
                }
                if (mimeType != null) {
                    request.setMimeType(mimeType);
                }
                request.setTitle(fileName);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+: public Downloads needs no storage permission.
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                } else {
                    // Android 7-9 would need WRITE_EXTERNAL_STORAGE for the public folder;
                    // the app's own Downloads dir needs none, and the completion
                    // notification still opens the file.
                    request.setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, fileName);
                }

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(MainActivity.this, "Downloading…", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });

        // Back button: navigate back inside the WebView when possible; on the
        // first page, send the app to the background (like the Home button).
        // The callback is never disabled, so it keeps working after the app is
        // resumed (disabling it broke Back on Android 12+, where the activity
        // isn't recreated on resume).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    public void onPause() {
        super.onPause();
        // Persist the session cookie to disk so the user stays logged in
        // even if Android kills the app while it's in the background.
        CookieManager.getInstance().flush();
    }
}

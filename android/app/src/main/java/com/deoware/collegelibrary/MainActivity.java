package com.deoware.collegelibrary;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fixes a well-known Android WebView bug: a getUserMedia() camera
        // stream (used here by the QR scanner) starts fine — no JS error,
        // no permission error — but renders as a plain black rectangle
        // instead of the actual video, because the WebView's default
        // hardware-accelerated compositing doesn't correctly paint the
        // camera's video surface. Forcing the WebView onto a hardware
        // layer makes it actually draw the frames.
        this.bridge.getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);
    }
}

package com.zly.productitem;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OfflineSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

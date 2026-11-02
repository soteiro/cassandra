package com.cassandra.app;

import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(AppWindowPlugin.class);
        super.onCreate(savedInstanceState);
        // Fondo del WebView antes de que pinte la página: claro u oscuro según el sistema
        // (values-night). Después SystemBarsService aplica los colores de la paleta.
        getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.app_background));
    }
}

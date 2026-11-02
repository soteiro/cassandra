package com.cassandra.app;

import android.graphics.Color;
import android.view.Window;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Pinta el fondo de la ventana y de las barras del sistema con el color de la paleta web. */
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void setBackgroundColor(PluginCall call) {
        int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException e) {
            call.reject("Color inválido");
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            // Capacitor deja el WebView debajo de las barras (sin viewport-fit=cover): lo que se ve
            // detrás de ellas es el fondo de la ventana. Desde Android 15 las barras son
            // transparentes; antes se pintan con setStatusBarColor y setNavigationBarColor.
            window.getDecorView().setBackgroundColor(color);
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            getBridge().getWebView().setBackgroundColor(color);
            call.resolve();
        });
    }
}

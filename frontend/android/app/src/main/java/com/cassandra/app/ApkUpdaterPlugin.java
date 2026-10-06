package com.cassandra.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** Descarga actualizaciones fuera del WebView; DownloadManager sobrevive al cierre de la app. */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String MIME_APK = "application/vnd.android.package-archive";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("apk-updater", Context.MODE_PRIVATE);
    }

    private DownloadManager manager() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private JSObject state(String status) {
        JSObject result = new JSObject();
        result.put("status", status);
        return result;
    }

    private JSObject failed(String message) {
        JSObject result = state("failed");
        result.put("error", message);
        return result;
    }

    private File downloadedFile() {
        String name = preferences().getString("filename", null);
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return name == null || directory == null ? null : new File(directory, name);
    }

    private long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private JSObject downloadStatus() throws Exception {
        long id = preferences().getLong("downloadId", -1);
        if (id == -1) return state("idle");
        try (Cursor cursor = manager().query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return failed("La descarga ya no está disponible. Vuelve a descargar la actualización.");
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                File file = downloadedFile();
                if (file == null || !file.isFile()) return failed("No se encontró el APK. Vuelve a descargar la actualización.");
                PackageInfo apk = getContext().getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
                if (apk == null || !getContext().getPackageName().equals(apk.packageName)) {
                    return failed("El archivo descargado no es una actualización válida de Cassandra.");
                }
                PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                if (versionCode(installed) >= versionCode(apk)) {
                    manager().remove(id);
                    preferences().edit().clear().apply();
                    return state("idle");
                }
                return state("ready");
            }
            if (status == DownloadManager.STATUS_FAILED) {
                int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                if (reason == DownloadManager.ERROR_INSUFFICIENT_SPACE) return failed("No hay espacio suficiente para descargar el APK.");
                return failed("No se pudo descargar la actualización. Revisa tu conexión y vuelve a intentarlo.");
            }
            JSObject result = state(status == DownloadManager.STATUS_PAUSED ? "paused" : "downloading");
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long received = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            if (total > 0) result.put("progress", Math.min(100, Math.max(0, received * 100 / total)));
            return result;
        }
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost()) ||
            path == null || !path.startsWith("/soteiro/cassandra/releases/download/") || !path.endsWith("/cassandra.apk")) {
            call.reject("La dirección de actualización no es válida.");
            return;
        }
        try {
            JSObject previous = downloadStatus();
            String status = previous.getString("status");
            if ("downloading".equals(status) || "paused".equals(status)) {
                call.resolve(previous);
                return;
            }
            // Elimina solo la descarga anterior administrada por este plugin.
            long oldId = preferences().getLong("downloadId", -1);
            if (oldId != -1) manager().remove(oldId);
            String filename = "cassandra-" + System.currentTimeMillis() + ".apk";
            DownloadManager.Request request = new DownloadManager.Request(uri)
                .setTitle("Actualización de Cassandra")
                .setDescription("Descargando el APK")
                .setMimeType(MIME_APK)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, filename);
            long id = manager().enqueue(request);
            preferences().edit().putLong("downloadId", id).putString("filename", filename).apply();
            call.resolve(state("downloading"));
        } catch (Exception e) {
            call.reject("No se pudo iniciar la descarga de la actualización.", e);
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        try {
            call.resolve(downloadStatus());
        } catch (Exception e) {
            call.reject("No se pudo consultar la descarga de la actualización.", e);
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            if (!"ready".equals(downloadStatus().getString("status"))) {
                call.reject("La actualización no está lista. Vuelve a descargarla.");
                return;
            }
            boolean permissionRequired = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !getContext().getPackageManager().canRequestPackageInstalls();
            Intent intent;
            if (permissionRequired) {
                intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            } else {
                Uri apk = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", downloadedFile());
                intent = new Intent(Intent.ACTION_VIEW).setDataAndType(apk, MIME_APK)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("permissionRequired", permissionRequired);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo abrir el instalador de Android.", e);
        }
    }
}

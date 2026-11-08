package in.arogyahealth.ehr;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.util.Base64;
import java.io.OutputStream;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final int SAVE_PDF = 42;
    private WebView webView, outputView;
    private byte[] pendingPdfData;
    private boolean outputBusy, outputReady;
    private ValueCallback<Uri[]> fileChoice;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                    catch (Exception e) { message("No app available to open WhatsApp."); }
                    return true;
                }
                return !url.startsWith("file:///android_asset/");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChoice != null) fileChoice.onReceiveValue(null);
                fileChoice = callback;
                try { startActivityForResult(params.createIntent(), 43); }
                catch (Exception e) { fileChoice.onReceiveValue(null); fileChoice = null; message("No file picker available."); }
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }
    private void message(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }
    public class WebAppInterface {
        @JavascriptInterface public void saveTextFile(String text, String filename, String mime) {
            runOnUiThread(() -> {
                if (pendingPdfData != null) { message("Finish the current export first."); return; }
                if (!mime.equals("application/json") && !mime.equals("text/csv")) return;
                pendingPdfData = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE, filename);
                try { startActivityForResult(intent, SAVE_PDF); }
                catch (Exception e) { pendingPdfData = null; message("No file picker available."); }
            });
        }
        @JavascriptInterface public void printPrescriptionHtml(String html) {
            runOnUiThread(() -> prepareOutput(html));
        }
        @JavascriptInterface public void savePrescriptionPdf(String dataUri, String filename) {
            runOnUiThread(() -> {
                if (pendingPdfData != null) { message("Finish the current export first."); return; }
                try {
                    int comma = dataUri.indexOf(',');
                    pendingPdfData = Base64.decode(dataUri.substring(comma + 1), Base64.DEFAULT);
                    if (pendingPdfData.length < 5 || pendingPdfData[0] != '%' || pendingPdfData[1] != 'P') throw new IllegalArgumentException();
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/pdf");
                    intent.putExtra(Intent.EXTRA_TITLE, filename);
                    startActivityForResult(intent, SAVE_PDF);
                } catch (Exception e) { pendingPdfData = null; message("Could not prepare the PDF file."); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 43) {
            if (fileChoice != null) fileChoice.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileChoice = null;
            return;
        }
        if (request != SAVE_PDF) return;
        byte[] pdf = pendingPdfData;
        pendingPdfData = null;
        if (result == RESULT_OK && data != null && data.getData() != null) {
            if (pdf == null) { message("Export interrupted. Please tap Download PDF again."); return; }
            try (OutputStream stream = getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (stream == null) throw new IllegalStateException();
                stream.write(pdf);
                message("File saved.");
            } catch (Exception e) { message("Unable to write PDF to this location."); }
        }
    }
    private PrintAttributes attributes() {
        return new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(new PrintAttributes.Resolution("pdf", "PDF", 300, 300))
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS).setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
    }
    private void prepareOutput(String html) {
        if (outputBusy) { message("Finish the current export first."); return; }
        outputBusy = true;
        outputReady = false;
        outputView = new WebView(this);
        outputView.getSettings().setJavaScriptEnabled(false);
        outputView.getSettings().setAllowFileAccess(false);
        outputView.getSettings().setBlockNetworkLoads(true);
        outputView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (outputReady) return;
                outputReady = true;
                // Post through the attached app view; an offscreen WebView queues posts until attached.
                webView.post(() -> {
                    if (isFinishing() || isDestroyed()) { cleanupOutput(); return; }
                    try {
                        {
                            PrintManager manager = (PrintManager)getSystemService(Context.PRINT_SERVICE);
                            if (manager == null) throw new IllegalStateException();
                            PrintDocumentAdapter delegate = view.createPrintDocumentAdapter("Arogya prescription");
                            manager.print("Arogya prescription", new PrintDocumentAdapter() {
                                @Override public void onStart() { delegate.onStart(); }
                                @Override public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs, CancellationSignal cancel, LayoutResultCallback callback, Bundle extras) {
                                    delegate.onLayout(oldAttrs, newAttrs, cancel, callback, extras);
                                }
                                @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor file, CancellationSignal cancel, WriteResultCallback callback) {
                                    delegate.onWrite(pages, file, cancel, callback);
                                }
                                @Override public void onFinish() { delegate.onFinish(); cleanupOutput(); }
                            }, attributes());
                        }
                    } catch (Exception e) { message("Could not create the prescription document. Please try again."); cleanupOutput(); }
                });
            }
        });
        outputView.loadDataWithBaseURL("https://arogya.invalid/", html, "text/html", "UTF-8", null);
    }
    private void cleanupOutput() {
        if (outputView != null) { outputView.destroy(); outputView = null; }
        outputBusy = false;
    }
    @Override protected void onDestroy() {
        cleanupOutput();
        if (webView != null) { webView.removeJavascriptInterface("AndroidNative"); webView.destroy(); }
        super.onDestroy();
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}

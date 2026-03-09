package com.asuozhang.linkstack;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import java.net.URLEncoder;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        loadFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        loadFromIntent(intent);
    }

    private void loadFromIntent(Intent intent) {
        String base = BuildConfig.WEB_APP_URL;
        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text == null) text = "";
            String url = extractFirstUrl(text);
            String target;
            if (!url.isEmpty()) {
                target = base + "?url=" + encode(url) + "&text=" + encode(text);
            } else {
                target = base + "?text=" + encode(text);
            }
            webView.loadUrl(target);
        } else {
            webView.loadUrl(base);
        }
    }

    private String extractFirstUrl(String text) {
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("https?://[^\\s]+");
        java.util.regex.Matcher m = pattern.matcher(text);
        if (m.find()) {
            String s = m.group().trim();
            while (s.endsWith(".") || s.endsWith(",") || s.endsWith(";") || s.endsWith(")")) {
                s = s.substring(0, s.length() - 1);
            }
            return s;
        }
        return "";
    }

    private String encode(String v) {
        try {
            return URLEncoder.encode(v, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }
}

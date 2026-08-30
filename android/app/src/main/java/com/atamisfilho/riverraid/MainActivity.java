package com.atamisfilho.riverraid;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * River Raid Remaster — invólucro Android nativo.
 *
 * Carrega o jogo (HTML/JS/CSS autossuficiente) de dentro do APK
 * (file:///android_asset/www/index.html). Sem internet: o jogo roda 100%
 * offline; o ranking online simplesmente fica indisponível (a interface
 * mostra mensagem amigável).
 */
public class MainActivity extends Activity {

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // mantém a tela acesa durante as partidas
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage: posições dos controles, etc.
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false); // áudio liberado após "DECOLAR"
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF0B0F14);
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");

        immerse();
    }

    /** Modo imersivo persistente (sem barra de status nem de navegação). */
    private void immerse() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immerse();
    }

    /**
     * Botão voltar: pausa a partida em andamento (abre o menu de pausa do
     * jogo); pressionado novamente (ou fora de partida) encerra o app.
     */
    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(function(){var g=window.__rrGame;"
                        + "if(g&&!g.paused&&!g.over){g.pause();return 'paused';}"
                        + "return 'exit';})()",
                value -> {
                    if (value == null || value.contains("exit")) {
                        finish();
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause(); // congela o loop do jogo e economiza bateria
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}

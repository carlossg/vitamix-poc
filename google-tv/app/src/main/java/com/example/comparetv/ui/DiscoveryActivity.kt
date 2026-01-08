package com.example.comparetv.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import java.net.URLEncoder

import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings

class DiscoveryActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val TAG = "DiscoveryActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)

        webView.webViewClient = WebViewClient()
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        
        // Set custom user agent to identify as TV
        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = "$defaultUserAgent AndroidTV VitamixTV/1.0"

        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.d(TAG, "onNewIntent called with: ${intent.data}")
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        val uri = intent.data
        Log.d(TAG, "Handling intent with URI: $uri")
        
        val query = uri?.getQueryParameter("q") 
            ?: intent.getStringExtra("q") 
            ?: intent.getStringExtra("query")
            ?: "the Ascent Series blenders"
        
        Log.d(TAG, "Extracted query: $query")
        
        val prompt = "Show me $query"
        val encodedPrompt = URLEncoder.encode(prompt, "UTF-8")
        
        // Read URL from SharedPreferences
        val sharedPref = getSharedPreferences("vitamix_prefs", android.content.Context.MODE_PRIVATE)
        val baseUrl = sharedPref.getString("vitamix_url", "https://main--materialised-web--paolomoz.aem.page/")
        
        val url = if (baseUrl?.contains("?") == true) {
            "${baseUrl}&cerebras=$encodedPrompt&tv=1"
        } else {
            "${baseUrl}?cerebras=$encodedPrompt&tv=1"
        }

        Log.d(TAG, "Loading URL: $url")
        webView.loadUrl(url)
    }

    override fun onKeyUp(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        if (keyCode == android.view.KeyEvent.KEYCODE_MENU) {
            startActivity(Intent(this, SettingsActivity::class.java))
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}

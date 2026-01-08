package com.example.comparetv.ui

import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.example.comparetv.R

class SettingsActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val editUrl = findViewById<EditText>(R.id.edit_vitamix_url)
        val btnSave = findViewById<Button>(R.id.btn_save)

        val sharedPref = getSharedPreferences("vitamix_prefs", Context.MODE_PRIVATE)
        val currentUrl = sharedPref.getString("vitamix_url", "https://main--materialised-web--paolomoz.aem.page/")
        editUrl.setText(currentUrl)

        btnSave.setOnClickListener {
            val newUrl = editUrl.text.toString()
            if (newUrl.isNotEmpty()) {
                sharedPref.edit().putString("vitamix_url", newUrl).apply()
                Toast.makeText(this, getString(R.string.msg_url_saved), Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }
}

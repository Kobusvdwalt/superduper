package com.kobus.superduper.health

import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/** Shown by Health Connect when the user asks why the app wants health data. */
class HealthRationaleActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = getString(R.string.health_rationale_title)
        val padding = (24 * resources.displayMetrics.density).toInt()
        val text = TextView(this).apply {
            textSize = 16f
            setPadding(padding, padding, padding, padding)
            text = getString(R.string.health_rationale_body)
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}

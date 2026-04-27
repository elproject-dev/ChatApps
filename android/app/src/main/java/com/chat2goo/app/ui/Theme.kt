package com.chat2goo.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF28a3a3),
    secondary = Color(0xFF1a6a6a),
    tertiary = Color(0xFFFF5500)
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF28a3a3),
    secondary = Color(0xFF1a6a6a),
    tertiary = Color(0xFFFF5500)
)

@Composable
fun Chat2GooTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

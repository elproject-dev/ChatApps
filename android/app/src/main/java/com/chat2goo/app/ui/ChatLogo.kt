package com.chat2goo.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun ChatLogo(
    modifier: Modifier = Modifier,
    color: Color = Color(0xFFFF4500)
) {
    Canvas(modifier = modifier.size(512.dp)) {
        val width = size.width
        val height = size.height

        val w = width / 1000f
        val h = height / 1000f

        val path = Path().apply {
            fillType = PathFillType.EvenOdd

            // Outer shape: rounded rectangle with a tail
            // We'll construct it using a path to include the tail seamlessly
            
            // Start from top-left curve
            moveTo(250f * w, 200f * h)
            
            // Top edge
            lineTo(750f * w, 200f * h)
            // Top-right corner
            quadraticTo(900f * w, 200f * h, 900f * w, 350f * h)
            
            // Right edge
            lineTo(900f * w, 600f * h)
            // Bottom-right corner
            quadraticTo(900f * w, 750f * h, 750f * w, 750f * h)
            
            // Bottom edge (right of tail)
            lineTo(550f * w, 750f * h)
            
            // Tail
            lineTo(450f * w, 880f * h)
            lineTo(450f * w, 750f * h)
            
            // Bottom edge (left of tail)
            lineTo(250f * w, 750f * h)
            // Bottom-left corner
            quadraticTo(100f * w, 750f * h, 100f * w, 600f * h)
            
            // Left edge
            lineTo(100f * w, 350f * h)
            // Top-left corner
            quadraticTo(100f * w, 200f * h, 250f * w, 200f * h)
            
            close()

            // Inner hole: another rounded rectangle
            addRoundRect(
                RoundRect(
                    rect = Rect(280f * w, 350f * h, 720f * w, 600f * h),
                    cornerRadius = CornerRadius(100f * w, 100f * h)
                )
            )
        }

        drawPath(path, color)
    }
}

@Preview(showBackground = true)
@Composable
fun ChatLogoPreview() {
    Chat2GooTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            ChatLogo(modifier = Modifier.size(200.dp))
        }
    }
}

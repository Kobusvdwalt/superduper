package com.kobus.superduper.health

import java.net.URI

internal object ServerPolicy {
    private val loopback = setOf("localhost", "127.0.0.1", "[::1]", "::1")

    /** HTTPS only; plain HTTP to loopback (adb reverse) only in debuggable builds. */
    fun origin(input: String, debuggable: Boolean): String {
        val uri = try {
            URI(input.trim())
        } catch (_: Exception) {
            throw IllegalArgumentException("Server URL is not a URL")
        }
        val host = uri.host ?: throw IllegalArgumentException("Server URL has no host")
        val scheme = uri.scheme?.lowercase()
        val allowed = scheme == "https" || (scheme == "http" && debuggable && host.lowercase() in loopback)
        require(allowed) { "Server URL must use https" }
        require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null && (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/")) {
            "Server URL must be an origin"
        }
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://${host.lowercase()}$port"
    }
}

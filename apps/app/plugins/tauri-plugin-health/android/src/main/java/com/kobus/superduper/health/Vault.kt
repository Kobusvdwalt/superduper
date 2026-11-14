package com.kobus.superduper.health

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** AES-256-GCM with a non-exportable Android Keystore key. Output is `iv || ciphertext+tag`. */
internal object Vault {
    private const val ALIAS = "superduper-health-v1"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128

    @Volatile private var cached: SecretKey? = null

    @Synchronized
    private fun key(): SecretKey {
        cached?.let { return it }
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val key = (store.getKey(ALIAS, null) as? SecretKey) ?: KeyGenerator
            .getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            .apply {
                init(
                    KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setKeySize(256)
                        .build(),
                )
            }
            .generateKey()
        cached = key
        return key
    }

    fun seal(plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return cipher.iv + cipher.doFinal(plain)
    }

    fun open(sealed: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
        }
        return cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES)
    }

    fun seal(text: String): ByteArray = seal(text.toByteArray(Charsets.UTF_8))

    fun openText(sealed: ByteArray): String = String(open(sealed), Charsets.UTF_8)
}

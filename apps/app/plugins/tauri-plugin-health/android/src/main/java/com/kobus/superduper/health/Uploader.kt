package com.kobus.superduper.health

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.io.IOException

internal class QueuedBatch(val batchId: String, val body: String)

internal interface Outbox {
    /** The oldest batch that is still pending, or null when the queue is drained. */
    fun head(): QueuedBatch?
    fun acknowledge(batchId: String)
    /** Keeps the batch for inspection but stops sending it; it can never succeed. */
    fun reject(batchId: String, reason: String)
    fun attemptFailed(batchId: String, reason: String)
}

internal class HttpReply(val status: Int, val body: String)

internal fun interface Transport {
    @Throws(IOException::class)
    fun post(body: String): HttpReply
}

internal sealed class Reply {
    object Acknowledged : Reply()
    class Rejected(val reason: String) : Reply()
    class Unauthenticated(val reason: String) : Reply()
    class Transient(val reason: String) : Reply()
}

internal sealed class DrainResult {
    abstract val sent: Int
    abstract val rejected: Int

    class Drained(override val sent: Int, override val rejected: Int) : DrainResult()
    class Unauthenticated(override val sent: Int, override val rejected: Int, val reason: String) : DrainResult()
    class Interrupted(override val sent: Int, override val rejected: Int, val reason: String) : DrainResult()
}

internal object Replies {
    private val permanent = setOf("BAD_USER_INPUT", "CONFLICT")

    fun classify(reply: HttpReply, batchId: String): Reply {
        val json = runCatching { Json.parseToJsonElement(reply.body) as? JsonObject }.getOrNull()
        val error = (json?.get("errors") as? JsonArray)?.firstOrNull() as? JsonObject
        if (error != null) {
            val code = ((error["extensions"] as? JsonObject)?.get("code") as? JsonPrimitive)?.contentOrNull
            val message = (error["message"] as? JsonPrimitive)?.contentOrNull ?: "GraphQL error"
            val reason = if (code != null) "$code: $message" else message
            return when {
                code == "UNAUTHENTICATED" -> Reply.Unauthenticated(reason)
                code in permanent -> Reply.Rejected(reason)
                else -> Reply.Transient(reason)
            }
        }
        if (reply.status == 401) return Reply.Unauthenticated("HTTP 401")
        if (reply.status == 413) return Reply.Rejected("HTTP 413: request body too large")
        if (reply.status !in 200..299) return Reply.Transient("HTTP ${reply.status}")
        val ack = (json?.get("data") as? JsonObject)
            ?.let { it["health"] as? JsonObject }
            ?.let { it["sync"] as? JsonObject }
            ?.let { (it["batchId"] as? JsonPrimitive)?.contentOrNull }
        return when (ack) {
            batchId -> Reply.Acknowledged
            null -> Reply.Transient("Response carried no acknowledgement")
            else -> Reply.Transient("Acknowledgement $ack does not match batch $batchId")
        }
    }
}

/** Sends queued batches oldest first, keeping each until the API acknowledges its batchId. */
internal class Uploader(private val outbox: Outbox, private val transport: Transport) {
    fun drain(): DrainResult {
        var sent = 0
        var rejected = 0
        while (true) {
            val batch = outbox.head() ?: return DrainResult.Drained(sent, rejected)
            val reply = try {
                Replies.classify(transport.post(batch.body), batch.batchId)
            } catch (error: IOException) {
                Reply.Transient("Network error: ${error.message ?: error.javaClass.simpleName}")
            }
            when (reply) {
                Reply.Acknowledged -> { outbox.acknowledge(batch.batchId); sent++ }
                is Reply.Rejected -> { outbox.reject(batch.batchId, reply.reason); rejected++ }
                is Reply.Unauthenticated -> {
                    outbox.attemptFailed(batch.batchId, reply.reason)
                    return DrainResult.Unauthenticated(sent, rejected, reply.reason)
                }
                is Reply.Transient -> {
                    outbox.attemptFailed(batch.batchId, reply.reason)
                    return DrainResult.Interrupted(sent, rejected, reply.reason)
                }
            }
        }
    }
}

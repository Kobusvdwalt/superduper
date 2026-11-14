package com.kobus.superduper.health;

import androidx.health.connect.client.records.metadata.DataOrigin;
import androidx.health.connect.client.records.metadata.Device;
import androidx.health.connect.client.records.metadata.Metadata;
import java.time.Instant;

/**
 * Metadata with a fixed id, origin and modification time. The full constructor is Kotlin
 * internal in connect-client 1.1.0, which Java does not enforce.
 */
final class TestMetadata {
    private TestMetadata() {}

    static Metadata create(
            int recordingMethod,
            String id,
            String dataOrigin,
            Instant lastModifiedTime,
            String clientRecordId,
            long clientRecordVersion,
            Device device) {
        return new Metadata(
                recordingMethod, id, new DataOrigin(dataOrigin), lastModifiedTime,
                clientRecordId, clientRecordVersion, device);
    }
}

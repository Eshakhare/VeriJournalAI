import { describe, it, expect, vi } from 'vitest';
import { VeriJournalApiClient } from '../../src/services/apiClient';

describe('End-to-End Asynchronous Verification Workflow (Integration)', () => {
  const getToken = vi.fn().mockResolvedValue('integration_test_token');
  const client = new VeriJournalApiClient(getToken);

  it('completes the full lifecycle: submission -> operation progress -> journal retrieval -> reflection', async () => {
    // 1. Submit text verification request
    const accepted = await client.submitTextVerification({
      text: 'Sample satellite image indicates rapid reforestation project progress.',
      initialConfidence: 60,
      initialReflection: 'Prior belief: project is advancing according to published schedule.',
    });

    expect(accepted).toBeDefined();
    expect(accepted.status).toBe('queued');
    expect(accepted.operationId).toMatch(/^op_/);

    // 2. Poll the operation
    const op = await client.getOperation(accepted.operationId);
    expect(op.status).toBe(200);
    expect(op.data?.operationId).toBe(accepted.operationId);

    // 3. Retrieve journal entries list
    const journalPage = await client.listJournalEntries(undefined, 10);
    expect(journalPage.entries).toBeDefined();
    expect(journalPage.entries.length).toBeGreaterThan(0);

    const summary = journalPage.entries[0];
    expect(summary.entryId).toBeDefined();

    // 4. Fetch full journal entry
    const testEntry = await client.getJournalEntry(summary.entryId);
    expect(testEntry.entryId).toBe(summary.entryId);
    expect(testEntry.evidence).toBeDefined();
    expect(testEntry.timeline).toBeDefined();
    expect(testEntry.claims).toBeDefined();

    // 5. Update personal reflection with post-evidence confidence
    const updatedReflection = await client.updateReflection(testEntry.entryId, {
      updatedConfidence: 85,
      updatedReflection: 'Updated stance based on verified multi-source corroboration and satellite EXIF check.',
    });

    expect(updatedReflection.updatedConfidence).toBe(85);
    expect(updatedReflection.updatedReflection).toContain('multi-source corroboration');
  });

  it('supports streaming conversational interaction grounded on evidence ledger', async () => {
    const journalPage = await client.listJournalEntries(undefined, 1);
    const summary = journalPage.entries[0];

    const chunks: string[] = [];
    for await (const chunk of client.streamEntryChat(
      summary.entryId,
      'What are the conflicting claims detected?'
    )) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const fullResponse = chunks.join('');
    expect(fullResponse.length).toBeGreaterThan(20);
  });
});


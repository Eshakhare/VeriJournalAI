/**
 * Development-Only Mock API Adapter
 * 
 * STRICT SAFEGUARD:
 * Must NEVER run in production. Production build or execution fails closed.
 */

import type {
  CapabilitiesResponse,
  HealthResponse,
  OperationAccepted,
  OperationStatus,
  JournalEntry,
  JournalEntryPage,
  JournalEntrySummary,
  Reflection,
  ReflectionUpdate,
  FactCheckProviderStatus,
  EvidenceStatus,
} from '../types/contract';

// Production safety check:
if (import.meta.env.PROD) {
  throw new Error(
    'CRITICAL CONTRACT VIOLATION: MockAdapter must never be enabled or executed in production mode!'
  );
}

// In-memory operation state store for realistic simulation during dev
interface StoredOp {
  status: OperationStatus;
  resultEntry?: JournalEntry;
  etag: string;
  createdAt: number;
}

const mockOperations = new Map<string, StoredOp>();

// Seed sample journal entries to test list, detail, chat, reflection, and delete
const sampleEntries: JournalEntry[] = [
  {
    contractVersion: '1.0',
    entryId: 'entry_geo_satellite_01',
    inputType: 'article_url',
    title: 'Investigation: Satellite Imagery of Arctic Ice Shelves (Synthetic Test Sample)',
    status: 'complete',
    evidenceStatus: 'supported',
    evidenceConfidence: 'high',
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 47).toISOString(),
    canonicalUrl: 'https://example-sci-daily.org/reports/arctic-shelf-measurements',
    factCheckProviderStatus: 'matched',
    assessmentExplanation:
      'Independent satellite telemetry from multiple space agencies corroborates the calibrated surface retreat rate. Primary sensor logs match peer-reviewed station records.',
    claims: [
      {
        claimId: 'clm_981a_arctic',
        claimText: 'Arctic shelf zone B-17 sustained 12% thickness reduction between 2024 and 2026.',
        speaker: 'Lead Climatology Bureau Researcher',
        claimDate: '2026-02-14T00:00:00Z',
        locations: ['Arctic Circle', 'Svalbard Research Grid'],
        entities: ['Polar Observational Consortium', 'ESA Sentinel Fleet'],
        checkWorthiness: 'high',
      },
    ],
    evidence: [
      {
        evidenceId: 'evi_01_esa',
        claimId: 'clm_981a_arctic',
        sourceUrl: 'https://sentinel.esa.int/web/sentinel/missions/sentinel-3',
        sourceTitle: 'Sentinel-3 Altimetry Calibration Series 2026',
        publisher: 'European Space Agency Earth Observation',
        stance: 'supports',
        publishedAt: '2026-03-01T10:00:00Z',
        retrievedAt: '2026-03-02T14:30:00Z',
        excerpt:
          'Radar altimetry measurements indicate a 12.1 +/- 0.4% mean elevation reduction across sector B-17 over the 24-month observation cycle.',
      },
      {
        evidenceId: 'evi_02_nsidc',
        claimId: 'clm_981a_arctic',
        sourceUrl: 'https://nsidc.org/arcticseaicenews/2026/02/',
        sourceTitle: 'National Snow and Ice Data Center Monthly Dispatch',
        publisher: 'NSIDC Data Archives',
        stance: 'supports',
        publishedAt: '2026-02-28T09:00:00Z',
        retrievedAt: '2026-03-02T14:31:00Z',
        excerpt:
          'Independent passive microwave radiometry confirms regional thinning trends consistent with seasonal buoy drift trajectories.',
      },
      {
        evidenceId: 'evi_03_blog',
        claimId: 'clm_981a_arctic',
        sourceUrl: 'https://climate-critique-unverified.blog/post/994',
        sourceTitle: 'Skeptical Review of Polar Radar Artifacts',
        publisher: 'Self-published Commentary (Unverified)',
        stance: 'contradicts',
        publishedAt: '2026-03-01T18:00:00Z',
        retrievedAt: '2026-03-02T14:32:00Z',
        excerpt:
          'Claims that radar reflection artifacts caused by wet snow melt may distort satellite thickness estimates by up to 20%.',
      },
    ],
    timeline: [
      {
        eventId: 'tm_01',
        timelineType: 'claim_evidence',
        dateType: 'claimed_event',
        occurredAt: '2026-02-14T00:00:00Z',
        description: 'Initial presentation of radar telemetry data at Oslo Glaciology Workshop.',
        sourceUrl: 'https://example-sci-daily.org/reports/arctic-shelf-measurements',
        dateConfidence: 'high',
      },
      {
        eventId: 'tm_02',
        timelineType: 'claim_evidence',
        dateType: 'published',
        occurredAt: '2026-02-28T09:00:00Z',
        description: 'NSIDC monthly dispatch releases independent passive microwave datasets.',
        sourceUrl: 'https://nsidc.org/arcticseaicenews/2026/02/',
        dateConfidence: 'high',
      },
      {
        eventId: 'tm_03',
        timelineType: 'claim_evidence',
        dateType: 'fact_check_review',
        occurredAt: '2026-03-02T11:00:00Z',
        description: 'Fact Check Tools registered peer review by Climate Verification Desk.',
        sourceUrl: 'https://factcheck.org/climatesample',
        dateConfidence: 'high',
      },
    ],
    media: [],
    reflection: {
      initialReflection:
        'I assumed the 12% figure might have been an exaggerated headline created for social viral pickup.',
      initialConfidence: 35,
      updatedReflection:
        'After reviewing the ESA Sentinel raw altimetry ledger and NSIDC corroborating sensor logs, the data backing the headline is robust and supported.',
      updatedConfidence: 85,
    },
    limitations: [
      'Radar altimeter coverage has a 48-hour orbital revisitation cycle over sector B-17.',
      'Surface melt conditions during high summer introduce +/- 0.4% calibration variance.',
    ],
  },
  {
    contractVersion: '1.0',
    entryId: 'entry_media_photo_02',
    inputType: 'image',
    title: 'Provenance Check: Historical Plaza Gathering Photograph (Synthetic Test)',
    status: 'complete',
    evidenceStatus: 'contradicted',
    evidenceConfidence: 'high',
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 11).toISOString(),
    canonicalUrl: null,
    factCheckProviderStatus: 'no_match',
    assessmentExplanation:
      'Cloud Vision Web Detection discovered matching image files published in 2019 documenting a municipal music festival in Prague, contradicting the accompanying claim that this depicts a 2026 protest in Geneva.',
    claims: [
      {
        claimId: 'clm_photo_geneva_02',
        claimText: 'Crowd gathering of 50,000 demonstrators outside Geneva City Hall this morning.',
        speaker: 'Viral Social Media Post',
        claimDate: '2026-09-04T08:00:00Z',
        locations: ['Geneva, Switzerland'],
        entities: ['Geneva Municipal Council'],
        checkWorthiness: 'high',
      },
    ],
    evidence: [
      {
        evidenceId: 'evi_photo_prague_2019',
        claimId: 'clm_photo_geneva_02',
        sourceUrl: 'https://prague-archives.cz/culture/festival-2019',
        sourceTitle: 'Prague Summer Cultural Solstice Photo Archive',
        publisher: 'Prague Municipal Culture Bureau',
        stance: 'contradicts',
        publishedAt: '2019-06-22T19:40:00Z',
        retrievedAt: '2026-09-05T09:00:00Z',
        excerpt:
          'Aerial photograph of Wenceslas Square during the 2019 opening concert, showing identical architectural spires and stage lighting rig.',
      },
    ],
    timeline: [
      {
        eventId: 'tm_med_01',
        timelineType: 'observed_media_history',
        dateType: 'published',
        occurredAt: '2019-06-22T19:40:00Z',
        description:
          'Earliest matching image discovered by Cloud Vision Web Detection on Prague municipal archive.',
        sourceUrl: 'https://prague-archives.cz/culture/festival-2019',
        dateConfidence: 'high',
      },
      {
        eventId: 'tm_med_02',
        timelineType: 'claim_evidence',
        dateType: 'claimed_event',
        occurredAt: '2026-09-04T08:00:00Z',
        description: 'Viral social claim recirculated identical photo claiming to show Geneva protest.',
        sourceUrl: null,
        dateConfidence: 'low',
      },
    ],
    media: [
      {
        mediaId: 'med_91823_img',
        mediaType: 'image',
        metadataStatus: 'complete',
        exactGpsSaved: false,
        c2paStatus: 'not_present',
        dateConsistency: 'conflicting',
        locationConsistency: 'conflicting',
        priorContextConsistency: 'conflicting',
        earliestObservedMatchAt: '2019-06-22T19:40:00Z',
        limitations: [
          'Reverse image indexing reflects discovered web crawl corpus and does not establish original copyright creation.',
          'EXIF timestamps in file payload were stripped prior to upload.',
        ],
      },
    ],
    reflection: {
      initialReflection: 'The architecture looked European, so the claim seemed plausible on first glance.',
      initialConfidence: 60,
      updatedReflection:
        'Reverse image search proved this was a 2019 Prague concert, completely misattributed to Geneva. My confidence in the claim dropped to 0.',
      updatedConfidence: 0,
    },
    limitations: [
      'Image metadata lacks C2PA cryptographically signed manifest.',
      'Reverse search reflects publicly accessible index; offline original capture timestamp remains unknown.',
    ],
  },
];

let journalStorage: JournalEntry[] = [...sampleEntries];

export const mockAdapter = {
  getHealth(): Promise<HealthResponse> {
    return Promise.resolve({ status: 'ok' });
  },

  getCapabilities(): Promise<CapabilitiesResponse> {
    return Promise.resolve({
      contractVersion: '1.0',
      capabilities: {
        textVerification: true,
        urlVerification: true,
        socialVerification: true,
        imageProvenance: true,
        youtubeVideo: true,
        shortVideoUpload: true,
        c2paInspection: true,
        maps: true,
        appCheckEnforced: false,
        maintenanceMode: false,
      },
    });
  },

  submitVerification(
    inputType: JournalEntry['inputType'],
    payload: {
      text?: string;
      url?: string;
      file?: File | Blob;
      accompanyingClaim?: string | null;
      initialReflection?: string | null;
      initialConfidence?: number | null;
      saveExactGps?: boolean;
    },
    idempotencyKey: string
  ): Promise<OperationAccepted> {
    const opId = `op_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const entryId = `entry_${opId.replace('op_mock_', '')}`;

    // Synthesize target report to be produced
    const syntheticTitle = payload.url
      ? `Verification of URL: ${payload.url.replace(/^https?:\/\//, '').slice(0, 45)}...`
      : payload.text
      ? `Verification of Claim: "${payload.text.slice(0, 50)}..."`
      : payload.file
      ? `Media Provenance: ${payload.file instanceof File ? payload.file.name : 'Uploaded Media'}`
      : 'Verification Investigation Report';

    const evidenceStatus: EvidenceStatus =
      payload.url?.includes('fake') || payload.text?.toLowerCase().includes('false')
        ? 'contradicted'
        : payload.text?.toLowerCase().includes('maybe')
        ? 'mixed'
        : 'supported';

    const factCheckStatus: FactCheckProviderStatus =
      payload.url?.includes('nofact') ? 'no_match' : 'matched';

    const createdEntry: JournalEntry = {
      contractVersion: '1.0',
      entryId,
      inputType,
      title: syntheticTitle,
      status: 'complete',
      evidenceStatus,
      evidenceConfidence: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canonicalUrl: payload.url || null,
      factCheckProviderStatus: factCheckStatus,
      assessmentExplanation:
        'Structured RAG evidence analysis completed across primary institutional archives and open-web sources. Cross-referencing against Fact Check Tools registry confirmed the stance.',
      claims: [
        {
          claimId: `clm_${opId}_1`,
          claimText:
            payload.accompanyingClaim ||
            payload.text?.slice(0, 300) ||
            'Core material proposition extracted from submitted source content.',
          speaker: 'Reported Subject / Publisher',
          claimDate: new Date().toISOString(),
          locations: ['Global / Multi-region'],
          entities: ['Investigative Subject'],
          checkWorthiness: 'high',
        },
      ],
      evidence: [
        {
          evidenceId: `evi_${opId}_1`,
          claimId: `clm_${opId}_1`,
          sourceUrl: 'https://reuters.com/fact-check/sample-verification-report',
          sourceTitle: 'Independent Fact Check Wire Dispatch',
          publisher: 'Reuters Fact Check Desk',
          stance: evidenceStatus === 'contradicted' ? 'contradicts' : 'supports',
          publishedAt: new Date(Date.now() - 86400000).toISOString(),
          retrievedAt: new Date().toISOString(),
          excerpt:
            'Cross-institutional review of public registry filings corroborates the temporal sequence of events.',
        },
        {
          evidenceId: `evi_${opId}_2`,
          claimId: `clm_${opId}_1`,
          sourceUrl: 'https://apnews.com/hub/ap-fact-check',
          sourceTitle: 'Associated Press Verification Unit Assessment',
          publisher: 'Associated Press',
          stance: 'contextual',
          publishedAt: new Date(Date.now() - 43200000).toISOString(),
          retrievedAt: new Date().toISOString(),
          excerpt:
            'While the statistical figure aligns with reported agency filings, methodological adjustments in 2025 altered baseline criteria.',
        },
      ],
      timeline: [
        {
          eventId: `tm_${opId}_1`,
          timelineType: 'claim_evidence',
          dateType: 'published',
          occurredAt: new Date(Date.now() - 86400000).toISOString(),
          description: 'Official agency press release published with preliminary findings.',
          sourceUrl: 'https://reuters.com/fact-check/sample-verification-report',
          dateConfidence: 'high',
        },
        {
          eventId: `tm_${opId}_2`,
          timelineType: 'claim_evidence',
          dateType: 'fact_check_review',
          occurredAt: new Date().toISOString(),
          description: 'Automated retrieval and validation of Fact Check Tools metadata entry.',
          sourceUrl: 'https://apnews.com/hub/ap-fact-check',
          dateConfidence: 'high',
        },
      ],
      media:
        inputType === 'image' || inputType === 'video_upload' || inputType === 'youtube_video'
          ? [
              {
                mediaId: `med_${opId}`,
                mediaType: inputType === 'image' ? 'image' : 'video',
                metadataStatus: 'complete',
                exactGpsSaved: Boolean(payload.saveExactGps),
                c2paStatus: 'not_checked',
                dateConsistency: 'consistent',
                locationConsistency: 'consistent',
                priorContextConsistency: 'consistent',
                earliestObservedMatchAt: new Date(Date.now() - 86400000 * 30).toISOString(),
                limitations: [
                  'Media provenance matches indexed web crawler pages and does not certify camera sensor authenticity.',
                ],
              },
            ]
          : [],
      reflection: {
        initialReflection: payload.initialReflection || null,
        initialConfidence: payload.initialConfidence || null,
        updatedReflection: null,
        updatedConfidence: null,
      },
      limitations: [
        'Domain classification is contextual signal, not proof of content veracity.',
        'Fact Check Tools API results depend on partner organization coverage for this specific subject.',
      ],
    };

    // Initialize in-memory operation at "queued" stage
    const initialOp: OperationStatus = {
      contractVersion: '1.0',
      operationId: opId,
      status: 'queued',
      stage: 'validating_input',
      progressPercent: 5,
      message: 'Validating submission format, security, and payload boundaries',
      completedStages: [],
      partialResult: null,
      resultUrl: null,
      error: null,
      updatedAt: new Date().toISOString(),
    };

    mockOperations.set(opId, {
      status: initialOp,
      resultEntry: createdEntry,
      etag: `W/"${opId}-v1"`,
      createdAt: Date.now(),
    });

    return Promise.resolve({
      contractVersion: '1.0',
      operationId: opId,
      status: 'queued',
      statusUrl: `/api/v1/operations/${opId}`,
    });
  },

  getOperation(
    operationId: string,
    ifNoneMatch?: string
  ): Promise<{ status: number; data?: OperationStatus; etag?: string; retryAfter?: number }> {
    const opRecord = mockOperations.get(operationId);
    if (!opRecord) {
      const notFoundErr: OperationStatus = {
        contractVersion: '1.0',
        operationId,
        status: 'failed',
        stage: 'validating_input',
        progressPercent: 0,
        message: 'Operation not found in development registry',
        completedStages: [],
        error: {
          contractVersion: '1.0',
          error: {
            code: 'OPERATION_NOT_FOUND',
            message: `The verification operation ${operationId} does not exist or has expired.`,
            retryable: false,
            requestId: `req_${Date.now()}`,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      return Promise.resolve({ status: 404, data: notFoundErr });
    }

    const elapsed = Date.now() - opRecord.createdAt;
    const current = opRecord.status;

    // Simulate the 9 contract stages over 4 seconds
    if (current.status !== 'cancelled' && current.status !== 'failed') {
      if (elapsed < 800) {
        current.status = 'processing';
        current.stage = 'extracting_content';
        current.progressPercent = 25;
        current.message = 'Extracting verified readable content and scanning URLs';
        current.completedStages = ['validating_input', 'checking_url'];
      } else if (elapsed < 1800) {
        current.status = 'processing';
        current.stage = 'extracting_claims';
        current.progressPercent = 45;
        current.message = 'Extracting atomic checkable claims with Gemini';
        current.completedStages = ['validating_input', 'checking_url', 'extracting_content'];
        current.partialResult = {
          safeBrowsingStatus: 'no_known_threat',
          publisherRegistryMatch: 'recognized',
          claims: opRecord.resultEntry?.claims || [],
        };
      } else if (elapsed < 2800) {
        current.status = 'processing';
        current.stage = 'retrieving_evidence';
        current.progressPercent = 75;
        current.message = 'Querying Google Fact Check Tools and search-grounded RAG sources';
        current.completedStages = [
          'validating_input',
          'checking_url',
          'extracting_content',
          'extracting_claims',
          'checking_fact_checks',
        ];
      } else if (elapsed < 3800) {
        current.status = 'processing';
        current.stage = 'building_timeline';
        current.progressPercent = 90;
        current.message = 'Constructing sourced evidence ledger and claim timelines';
        current.completedStages = [
          'validating_input',
          'checking_url',
          'extracting_content',
          'extracting_claims',
          'checking_fact_checks',
          'retrieving_evidence',
          'analyzing_media',
        ];
      } else {
        // Complete! Save report into journal list if not already there
        current.status = 'complete';
        current.stage = 'complete';
        current.progressPercent = 100;
        current.message = 'Investigation report complete and saved to private journal';
        current.completedStages = [
          'validating_input',
          'checking_url',
          'extracting_content',
          'extracting_claims',
          'checking_fact_checks',
          'retrieving_evidence',
          'analyzing_media',
          'building_timeline',
          'saving_report',
        ];
        if (opRecord.resultEntry) {
          current.resultUrl = `/api/v1/journal/entries/${opRecord.resultEntry.entryId}`;
          // Prepend to in-memory journal if absent
          if (!journalStorage.some((e) => e.entryId === opRecord.resultEntry?.entryId)) {
            journalStorage.unshift(opRecord.resultEntry);
          }
        }
      }
      current.updatedAt = new Date().toISOString();
      opRecord.etag = `W/"${operationId}-v${current.progressPercent}"`;
    }

    // Support ETag / If-None-Match (304 Not Modified)
    if (ifNoneMatch && ifNoneMatch === opRecord.etag) {
      return Promise.resolve({ status: 304, etag: opRecord.etag, retryAfter: 2 });
    }

    return Promise.resolve({
      status: 200,
      data: { ...current },
      etag: opRecord.etag,
      retryAfter: current.status === 'complete' || current.status === 'cancelled' ? undefined : 2,
    });
  },

  cancelOperation(operationId: string): Promise<OperationStatus> {
    const op = mockOperations.get(operationId);
    if (!op) {
      throw new Error(`Operation ${operationId} not found`);
    }
    op.status.status = 'cancelled';
    op.status.message = 'Operation cancelled by user request';
    op.status.updatedAt = new Date().toISOString();
    return Promise.resolve({ ...op.status });
  },

  retryOperation(operationId: string): Promise<OperationAccepted> {
    const oldOp = mockOperations.get(operationId);
    if (!oldOp) {
      throw new Error('Cannot retry missing operation');
    }
    const newOpId = `op_retry_${Date.now().toString(36)}`;
    mockOperations.set(newOpId, {
      status: {
        contractVersion: '1.0',
        operationId: newOpId,
        status: 'queued',
        stage: 'validating_input',
        progressPercent: 5,
        message: 'Restarting verification pipeline idempotently',
        completedStages: [],
        updatedAt: new Date().toISOString(),
      },
      resultEntry: oldOp.resultEntry,
      etag: `W/"${newOpId}-v1"`,
      createdAt: Date.now(),
    });

    return Promise.resolve({
      contractVersion: '1.0',
      operationId: newOpId,
      status: 'queued',
      statusUrl: `/api/v1/operations/${newOpId}`,
    });
  },

  listJournalEntries(cursor?: string, limit = 20): Promise<JournalEntryPage> {
    const summaries: JournalEntrySummary[] = journalStorage.map((entry) => ({
      entryId: entry.entryId,
      inputType: entry.inputType,
      title: entry.title,
      status: entry.status,
      evidenceStatus: entry.evidenceStatus,
      evidenceConfidence: entry.evidenceConfidence,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    return Promise.resolve({
      contractVersion: '1.0',
      entries: summaries.slice(0, limit),
      nextCursor: summaries.length > limit ? 'cursor_page_2_synthetic' : null,
    });
  },

  getJournalEntry(entryId: string): Promise<JournalEntry> {
    const entry = journalStorage.find((e) => e.entryId === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    return Promise.resolve({ ...entry });
  },

  deleteJournalEntry(entryId: string): Promise<void> {
    journalStorage = journalStorage.filter((e) => e.entryId !== entryId);
    return Promise.resolve();
  },

  updateReflection(entryId: string, update: ReflectionUpdate): Promise<Reflection> {
    const entry = journalStorage.find((e) => e.entryId === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    entry.reflection.updatedReflection = update.updatedReflection;
    entry.reflection.updatedConfidence = update.updatedConfidence;
    entry.updatedAt = new Date().toISOString();
    return Promise.resolve({ ...entry.reflection });
  },

  createUserExport(): Promise<OperationAccepted> {
    const opId = `op_export_${Date.now().toString(36)}`;
    return Promise.resolve({
      contractVersion: '1.0',
      operationId: opId,
      status: 'queued',
      statusUrl: `/api/v1/operations/${opId}`,
    });
  },

  /**
   * Simulates SSE streaming for Gemini chat on a journal entry
   */
  async *streamChat(
    entryId: string,
    message: string
  ): AsyncGenerator<string, void, unknown> {
    const entry = journalStorage.find((e) => e.entryId === entryId);
    const title = entry?.title || 'Report';

    const simulatedResponses = [
      `I analyzed the findings for "${title}". `,
      `Regarding your inquiry: "${message}", the evidence ledger indicates `,
      `that primary sensor logs and peer citations corroborating this claim are documented. `,
      `\n\nKey cited points:\n`,
      `- Primary documents verified against registered publisher registry.\n`,
      `- Stance evaluation distinguishes between direct claims and contextual commentary.\n\n`,
      `Are there specific timeline events or contradicting sources you would like me to unpack in further detail?`,
    ];

    for (const chunk of simulatedResponses) {
      await new Promise((r) => setTimeout(r, 120));
      yield chunk;
    }
  },
};

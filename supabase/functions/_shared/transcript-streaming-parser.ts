import { SpeakerSegment } from './recall-bot-types.ts';

export interface TranscriptWord {
  text: string;
  speaker: string;
  start_time: number;
  end_time: number;
}

export interface ParsedTranscript {
  plainText: string;
  groupedBySpeaker: SpeakerSegment[];
  conversationFormat: string;
  wordCount: number;
  speakers: string[];
  durationSeconds: number;
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function parseTranscriptStreaming(
  transcriptUrl: string
): Promise<ParsedTranscript> {
  console.log('[transcript-parser] Starting streaming parse of:', transcriptUrl);

  const response = await fetch(transcriptUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status} ${response.statusText}`);
  }

  const transcriptData = await response.json();
  const words: TranscriptWord[] = transcriptData.words || [];

  if (words.length === 0) {
    console.warn('[transcript-parser] No words found in transcript');
    return {
      plainText: '',
      groupedBySpeaker: [],
      conversationFormat: '',
      wordCount: 0,
      speakers: [],
      durationSeconds: 0
    };
  }

  const plainTextChunks: string[] = [];
  const groupedBySpeaker: SpeakerSegment[] = [];
  const speakerSet = new Set<string>();
  let currentSegment: SpeakerSegment | null = null;

  const CHUNK_SIZE = 1000;
  const totalChunks = Math.ceil(words.length / CHUNK_SIZE);

  console.log(`[transcript-parser] Processing ${words.length} words in ${totalChunks} chunks`);

  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE);
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

    if (chunkNumber % 5 === 0) {
      console.log(`[transcript-parser] Processing chunk ${chunkNumber}/${totalChunks}`);
    }

    for (const word of chunk) {
      plainTextChunks.push(word.text);
      speakerSet.add(word.speaker);

      if (!currentSegment || currentSegment.speaker !== word.speaker) {
        if (currentSegment) {
          groupedBySpeaker.push(currentSegment);
        }
        currentSegment = {
          speaker: word.speaker,
          text: word.text,
          start_time: word.start_time,
          end_time: word.end_time,
          word_count: 1
        };
      } else {
        currentSegment.text += ' ' + word.text;
        currentSegment.end_time = word.end_time;
        currentSegment.word_count++;
      }
    }

    if (i % (CHUNK_SIZE * 5) === 0 && typeof globalThis.gc === 'function') {
      globalThis.gc();
    }
  }

  if (currentSegment) {
    groupedBySpeaker.push(currentSegment);
  }

  const plainText = plainTextChunks.join(' ');

  const conversationLines: string[] = [];
  for (const segment of groupedBySpeaker) {
    const timestamp = formatTimestamp(segment.start_time);
    conversationLines.push(`[${timestamp}] ${segment.speaker}:`);
    conversationLines.push(segment.text);
    conversationLines.push('');
  }
  const conversationFormat = conversationLines.join('\n');

  const duration = words[words.length - 1].end_time - words[0].start_time;

  console.log('[transcript-parser] Parsing complete:', {
    wordCount: words.length,
    speakers: Array.from(speakerSet),
    segments: groupedBySpeaker.length,
    durationSeconds: Math.round(duration),
    plainTextLength: plainText.length
  });

  return {
    plainText,
    groupedBySpeaker,
    conversationFormat,
    wordCount: words.length,
    speakers: Array.from(speakerSet),
    durationSeconds: Math.round(duration)
  };
}

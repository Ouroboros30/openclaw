import { Type } from "@sinclair/typebox";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnyAgentTool } from "./common.js";
import { transcribeOpenAiCompatibleAudio } from "../../media-understanding/providers/openai/audio.js";
import { readStringParam } from "./common.js";

const TranscribeAudioToolSchema = Type.Object({
  filePath: Type.String({
    description: "Path to audio file to transcribe (supports mp3, wav, m4a, ogg, etc.)",
  }),
  language: Type.Optional(
    Type.String({
      description: "Optional ISO 639-1 language code (e.g., 'en', 'es', 'fr') to improve accuracy",
    }),
  ),
});

export function createTranscribeAudioTool(_opts?: { config?: unknown }): AnyAgentTool {
  return {
    label: "Transcribe Audio",
    name: "transcribe_audio",
    description:
      "Transcribe speech from an audio file to text. Use when the user asks to transcribe an audio file or extract text from voice recordings.",
    parameters: TranscribeAudioToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const filePath = readStringParam(params, "filePath", { required: true });
      const language = readStringParam(params, "language");

      try {
        // Read the audio file
        const buffer = await readFile(filePath);
        const fileName = path.basename(filePath);

        // Get API key from environment
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No OpenAI API key found in config or environment (OPENAI_API_KEY)",
              },
            ],
            details: { error: "missing_api_key" },
          };
        }

        // Transcribe the audio
        const result = await transcribeOpenAiCompatibleAudio({
          buffer,
          fileName,
          apiKey,
          language: language ?? undefined,
          model: "gpt-4o-mini-transcribe",
          timeoutMs: 120000, // 2 minutes
        });

        return {
          content: [
            {
              type: "text",
              text: `Transcription:\n\n${result.text}\n\n(Model: ${result.model})`,
            },
          ],
          details: {
            text: result.text,
            model: result.model,
            language: language ?? "auto-detected",
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error during transcription";
        return {
          content: [
            {
              type: "text",
              text: `Transcription failed: ${errorMessage}`,
            },
          ],
          details: { error: errorMessage },
        };
      }
    },
  };
}

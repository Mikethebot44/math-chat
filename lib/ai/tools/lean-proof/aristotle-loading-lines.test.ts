import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import {
  ARISTOTLE_LOADING_LINE_COUNT,
  buildFallbackAristotleLoadingLines,
  finalizeAristotleLoadingLines,
  getAristotlePromptForStatus,
} from "./aristotle-loading-lines";

function createMessage({
  id,
  parentMessageId = null,
  parts,
  role,
}: {
  id: string;
  parentMessageId?: string | null;
  parts: ChatMessage["parts"];
  role: ChatMessage["role"];
}): ChatMessage {
  return {
    id,
    role,
    parts,
    metadata: {
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
      parentMessageId,
      selectedModel: "openai/gpt-5-mini",
      activeStreamId: null,
    },
  };
}

describe("aristotle loading lines", () => {
  it("extracts the proof prompt from the leanProof tool input", () => {
    const assistantMessage = createMessage({
      id: "assistant-1",
      role: "assistant",
      parentMessageId: "user-1",
      parts: [
        {
          type: "tool-leanProof",
          toolCallId: "call-1",
          state: "output-available",
          input: {
            prompt: "Prove the sum of two even numbers is even.",
            mode: "formalize_and_prove",
          },
          output: {
            completed: false,
            jobId: "job-1",
          },
        },
      ],
    });

    const prompt = getAristotlePromptForStatus({
      messageId: assistantMessage.id,
      messages: [assistantMessage],
      tool: assistantMessage.parts[0] as Extract<
        ChatMessage["parts"][number],
        { type: "tool-leanProof" }
      >,
    });

    assert.equal(prompt, "Prove the sum of two even numbers is even.");
  });

  it("falls back to the nearest user message when the tool input has no prompt", () => {
    const userMessage = createMessage({
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "Show that n^2 - n is always even." }],
    });
    const assistantMessage = createMessage({
      id: "assistant-1",
      role: "assistant",
      parentMessageId: userMessage.id,
      parts: [
        {
          type: "tool-aristotleCheckJob",
          toolCallId: "call-2",
          state: "output-available",
          input: {
            jobId: "job-2",
            waitForCompletion: false,
          },
          output: {
            completed: false,
            jobId: "job-2",
          },
        },
      ],
    });

    const prompt = getAristotlePromptForStatus({
      messageId: assistantMessage.id,
      messages: [userMessage, assistantMessage],
      tool: assistantMessage.parts[0] as Extract<
        ChatMessage["parts"][number],
        { type: "tool-aristotleCheckJob" }
      >,
    });

    assert.equal(prompt, "Show that n^2 - n is always even.");
  });

  it("normalizes generated lines and pads them with short fallback verbs", () => {
    const prompt = "Prove every finite subgroup of C* is cyclic.";
    const finalized = finalizeAristotleLoadingLines({
      prompt,
      lines: [
        '"researching finite subgroup structure"',
        "researching finite subgroup structure",
        "checking cyclic cases.",
      ],
    });

    assert.equal(finalized.length, ARISTOTLE_LOADING_LINE_COUNT);
    assert.equal(finalized[0], "Researching finite subgroup structure...");
    assert.equal(finalized[1], "Checking cyclic cases...");
    assert(finalized.some((line) => line === "Formalizing..."));

    const fallback = buildFallbackAristotleLoadingLines(prompt);
    assert.equal(fallback.length, ARISTOTLE_LOADING_LINE_COUNT);
    assert(fallback.some((line) => line === "Discombobulating..."));
  });
});

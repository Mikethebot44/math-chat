"use client";

import { useEffect, useRef } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import {
  useAristotleLeanDownloadData,
  useLastMessageId,
} from "@/lib/stores/hooks-base";

export function AristotleLeanArtifactSync({
  messageId,
}: {
  messageId: string;
}) {
  const leanArtifact = useAristotleLeanDownloadData(messageId);
  const lastMessageId = useLastMessageId();
  const { setArtifact } = useArtifact();
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (
      !leanArtifact ||
      hasAutoOpenedRef.current ||
      lastMessageId !== messageId
    ) {
      return;
    }

    hasAutoOpenedRef.current = true;

    setArtifact({
      content: leanArtifact.code,
      date: new Date().toISOString(),
      documentId: "init",
      isVisible: true,
      kind: "code",
      messageId,
      status: "idle",
      title: leanArtifact.title,
    });
  }, [lastMessageId, leanArtifact, messageId, setArtifact]);

  return null;
}

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { getSpeechRecognition, type SpeechRecInstance } from "./speechRecognition";

type UseDictatedPromptCopyOptions = {
  onFinalize: (transcript: string) => void;
  listeningMessage?: string;
};

export function useDictatedPromptCopy({
  onFinalize,
  listeningMessage = "Listening… click Update again to stop and copy.",
}: UseDictatedPromptCopyOptions) {
  const recRef = useRef<SpeechRecInstance | null>(null);
  const transcriptRef = useRef("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      // no-op
    }
  };

  const toggle = () => {
    if (listening) {
      stop();
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) {
      toast.error("Speech recognition not available");
      return;
    }

    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      transcriptRef.current = "";
      setInterim("");
      setListening(true);
      recRef.current = rec;
      toast(listeningMessage);

      rec.onresult = (ev) => {
        let interimChunk = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const chunk = r[0]?.transcript ?? "";
          if (r.isFinal) transcriptRef.current += chunk;
          else interimChunk += chunk;
        }
        setInterim(interimChunk);
      };

      rec.onerror = () => {
        recRef.current = null;
        setListening(false);
        setInterim("");
        toast.error("Dictation failed");
      };

      rec.onend = () => {
        recRef.current = null;
        setListening(false);
        setInterim("");
        onFinalize(transcriptRef.current.trim());
      };

      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      setInterim("");
      toast.error("Could not start dictation");
    }
  };

  return { listening, interim, toggle, stop };
}

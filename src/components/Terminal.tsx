import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

export interface InstallLine {
  line: string;
  done: boolean;
  error: boolean;
}

interface Props {
  eventId?: string;        // Tauri event channel to listen on
  initialText?: string;
  className?: string;
  onDone?: () => void;
}

export default function Terminal({ eventId, initialText, className, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Init xterm
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
      },
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 2000,
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    if (initialText) term.write(initialText + "\r\n");

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
    };
  }, []);

  // Listen for Tauri events
  useEffect(() => {
    if (!eventId) return;

    let unlisten: (() => void) | undefined;

    listen<InstallLine>(eventId, (ev) => {
      const term = termRef.current;
      if (!term) return;

      const { line, done, error } = ev.payload;

      if (done) {
        term.write("\r\n\x1b[32m✓ Done\x1b[0m\r\n");
        onDone?.();
        return;
      }

      const color = error ? "\x1b[31m" : "";
      const reset = error ? "\x1b[0m" : "";
      term.write(`${color}${line}${reset}\r\n`);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [eventId, onDone]);

  return (
    <div
      ref={containerRef}
      className={`rounded-md overflow-hidden ${className ?? "h-64"}`}
      style={{ background: "#0d1117" }}
    />
  );
}

// Export imperative helpers via ref if needed in the future
export type TerminalRef = { clear: () => void; write: (text: string) => void };

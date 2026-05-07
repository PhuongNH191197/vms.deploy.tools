import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Trash2, Download, Search, X } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

interface LogLine {
  line: string;
  done: boolean;
}

interface ConnInfo {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
}

interface Props {
  container: string;
  conn: ConnInfo;
  onClose: () => void;
}

const TAIL_OPTIONS = [100, 200, 500, 1000] as const;

export default function LogPanel({ container, conn, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const linesRef = useRef<string[]>([]);
  const unlistenRef = useRef<(() => void) | null>(null);
  const eventIdRef = useRef(`logs-${container}-${Date.now()}`);

  const [paused, setPaused] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [tail, setTail] = useState<number>(200);
  const [search, setSearch] = useState("");

  // Init xterm
  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      theme: { background: "#0d1117", foreground: "#c9d1d9", cursor: "#58a6ff" },
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 12,
      lineHeight: 1.3,
      scrollback: 5000,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); term.dispose(); };
  }, []);

  const writeLine = useCallback((line: string) => {
    const term = termRef.current;
    if (!term) return;
    if (search && !line.toLowerCase().includes(search.toLowerCase())) {
      term.write(`\x1b[2m${line}\x1b[0m\r\n`); // dim non-matching
    } else if (search) {
      // Highlight matching part
      const idx = line.toLowerCase().indexOf(search.toLowerCase());
      const before = line.slice(0, idx);
      const match = line.slice(idx, idx + search.length);
      const after = line.slice(idx + search.length);
      term.write(`${before}\x1b[33;1m${match}\x1b[0m${after}\r\n`);
    } else {
      term.write(line + "\r\n");
    }
  }, [search]);

  const startStream = useCallback(async (tailN: number) => {
    // Stop existing stream
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
      invoke("stop_log_stream", { eventId: eventIdRef.current }).catch(() => {});
    }

    // Generate new event id
    eventIdRef.current = `logs-${container}-${Date.now()}`;
    linesRef.current = [];
    termRef.current?.clear();
    termRef.current?.write(`\x1b[36m--- ${container} (last ${tailN} lines) ---\x1b[0m\r\n`);

    setStreaming(true);
    setPaused(false);

    const unlisten = await listen<LogLine>(eventIdRef.current, (ev) => {
      const { line, done } = ev.payload;
      if (done) {
        setStreaming(false);
        return;
      }
      linesRef.current.push(line);
      writeLine(line);
    });
    unlistenRef.current = unlisten;

    invoke("stream_container_logs", {
      host: conn.host, port: conn.port, username: conn.username,
      authType: conn.authType, credential: conn.credential,
      container, tail: tailN, eventId: eventIdRef.current,
    }).catch((e) => {
      termRef.current?.write(`\r\n\x1b[31mError: ${e}\x1b[0m\r\n`);
      setStreaming(false);
    });
  }, [container, conn, writeLine]);

  // Auto-start on mount
  useEffect(() => {
    startStream(tail);
    return () => {
      unlistenRef.current?.();
      invoke("stop_log_stream", { eventId: eventIdRef.current }).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePause = () => {
    if (!paused) {
      unlistenRef.current?.();
      unlistenRef.current = null;
      invoke("stop_log_stream", { eventId: eventIdRef.current }).catch(() => {});
      setStreaming(false);
      setPaused(true);
    } else {
      startStream(tail);
    }
  };

  const handleClear = () => {
    termRef.current?.clear();
    linesRef.current = [];
  };

  const handleDownload = () => {
    const content = linesRef.current.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${container}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTailChange = (t: number) => {
    setTail(t);
    startStream(t);
  };

  // Re-render terminal on search change (highlight)
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.clear();
    linesRef.current.forEach((l) => writeLine(l));
  }, [search, writeLine]);

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/5 border-b border-muted/20">
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{container}</span>
        {streaming && <Badge className="bg-green-700 text-[10px] px-1 py-0">● live</Badge>}
        {paused && <Badge variant="secondary" className="text-[10px] px-1 py-0">paused</Badge>}

        <div className="flex items-center gap-1 ml-2">
          {TAIL_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => handleTailChange(t)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors
                ${tail === t ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-1 max-w-xs ml-2">
          <Search size={11} className="text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search…"
            className="h-6 text-xs bg-transparent border-muted-foreground/30"
          />
          {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handlePause} title={paused ? "Resume" : "Pause"}>
            {paused ? <Play size={11} /> : <Pause size={11} />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleClear} title="Clear">
            <Trash2 size={11} />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDownload} title="Download">
            <Download size={11} />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} title="Close">
            <X size={11} />
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={containerRef} className="h-64" style={{ background: "#0d1117" }} />
    </div>
  );
}

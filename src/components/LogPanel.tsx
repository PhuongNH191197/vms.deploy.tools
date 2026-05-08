import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Trash2, Download, Search, X, Terminal } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";

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
      theme: { 
        background: "#070B14", // deep navy base
        foreground: "#E2E8F0", 
        cursor: "#22D3EE",
        black: "#000000",
        red: "#F87171",
        green: "#34D399",
        yellow: "#FBBF24",
        blue: "#818CF8",
        magenta: "#A855F7",
        cyan: "#22D3EE",
        white: "#FFFFFF",
        selectionBackground: "rgba(34, 211, 238, 0.2)"
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 10000,
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
    
    // Simple colorization based on content
    let formatted = line;
    if (line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")) {
      formatted = `\x1b[31m${line}\x1b[0m`; // Red
    } else if (line.toLowerCase().includes("warn")) {
      formatted = `\x1b[33m${line}\x1b[0m`; // Yellow
    } else if (line.toLowerCase().includes("success") || line.toLowerCase().includes("done")) {
      formatted = `\x1b[32m${line}\x1b[0m`; // Green
    }

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
      term.write(formatted + "\r\n");
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
    termRef.current?.write(`\x1b[38;5;13m>>> INITIALIZING STREAM FOR: ${container.toUpperCase()}\x1b[0m\r\n`);
    termRef.current?.write(`\x1b[38;5;14m>>> RETRIEVING LAST ${tailN} LINES...\x1b[0m\r\n\r\n`);

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
      termRef.current?.write(`\r\n\x1b[31m[CRITICAL ERROR]: ${e}\x1b[0m\r\n`);
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
    <div className="flex flex-col glass-card rounded-2xl overflow-hidden border-white/5 shadow-2xl h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/[0.05]">
        <div className="flex items-center gap-2 mr-2 shrink-0">
           <Terminal size={14} className="text-df-purple" />
           <span className="text-[11px] font-black text-df-text-primary uppercase tracking-widest">{container}</span>
        </div>

        <div className="flex items-center gap-2">
          {streaming && <Badge className="badge-active text-[9px] px-2 py-0 h-5">LIVE</Badge>}
          {paused && <Badge className="bg-df-orange/20 text-df-orange border-df-orange/30 text-[9px] px-2 py-0 h-5">PAUSED</Badge>}
        </div>

        <div className="h-4 w-px bg-white/10 mx-2" />

        <div className="flex items-center gap-1">
          {TAIL_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => handleTailChange(t)}
              className={cn(
                "text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg border transition-all uppercase",
                tail === t 
                  ? "bg-df-cyan/10 border-df-cyan text-df-cyan shadow-neon-cyan/20" 
                  : "bg-white/5 border-white/10 text-df-text-secondary hover:border-white/30"
              )}
            >
              {t}L
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-xs relative ml-4">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-df-text-secondary opacity-50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="h-8 text-[11px] pl-9 pr-8 input-glass rounded-xl border-white/5"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-df-text-secondary hover:text-df-cyan"><X size={12} /></button>}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="ghost" className="h-8 w-8 btn-ghost-glass rounded-xl" onClick={handlePause} title={paused ? "Resume" : "Pause"}>
            {paused ? <Play size={14} className="text-df-green" /> : <Pause size={14} className="text-df-orange" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 btn-ghost-glass rounded-xl" onClick={handleClear} title="Clear">
            <Trash2 size={14} className="text-df-red" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 btn-ghost-glass rounded-xl" onClick={handleDownload} title="Download">
            <Download size={14} className="text-df-cyan" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 btn-ghost-glass rounded-xl ml-2 hover:bg-df-red/20" onClick={onClose} title="Close">
            <X size={16} className="text-df-text-secondary hover:text-df-red" />
          </Button>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 min-h-[400px] p-2 bg-[#070B14] relative group">
        <div ref={containerRef} className="h-full w-full" />
        {/* Subtle Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2 border-t border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
         <span className="text-[9px] font-black text-df-text-secondary uppercase tracking-[0.2em] opacity-40 italic">Secure TTY Connection Established</span>
         <span className="text-[9px] font-black text-df-cyan uppercase tracking-[0.2em]">{linesRef.current.length} lines cached</span>
      </div>
    </div>
  );
}

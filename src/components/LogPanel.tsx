import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play, Trash2, Download, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockContainer } from "@/types/monitor";

interface Props {
  container: MockContainer;
  command: string;
}

type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR";

interface LogLine {
  id: number;
  time: string;
  level: LogLevel;
  msg: string;
}

const LOG_POOL: Array<{ level: LogLevel; msgs: string[] }> = [
  {
    level: "INFO",
    msgs: [
      "Application heartbeat OK",
      "Listening on port 5000",
      "Request processed in 42ms",
      "Health check passed",
      "Connected to database",
      "Cache hit ratio: 94.2%",
      "Worker thread ready",
      "Scheduled task completed",
    ],
  },
  {
    level: "DEBUG",
    msgs: [
      "Connecting to database...",
      "Session token refreshed",
      "Memory GC triggered",
      "Config reloaded from disk",
      "Worker thread idle",
      "Queue depth: 0",
    ],
  },
  {
    level: "WARN",
    msgs: [
      "High memory usage detected: 78%",
      "Slow query detected: 2300ms",
      "Retry attempt 2/3",
      "Rate limit approaching: 85%",
      "Disk write latency elevated",
    ],
  },
  {
    level: "ERROR",
    msgs: [
      "Failed to process request: timeout",
      "Connection refused: redis:6379",
      "Unhandled exception in worker",
      "Circuit breaker tripped",
    ],
  },
];

function pickLog(id: number): LogLine {
  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const r = Math.random();
  const bucket =
    r < 0.5 ? LOG_POOL[0] : r < 0.75 ? LOG_POOL[1] : r < 0.9 ? LOG_POOL[2] : LOG_POOL[3];
  const msg = bucket.msgs[Math.floor(Math.random() * bucket.msgs.length)];
  return { id, time, level: bucket.level, msg };
}

const LEVEL_CLASS: Record<LogLevel, string> = {
  INFO: "text-[#22d3ee]",
  DEBUG: "text-[#4b5563]",
  WARN: "text-[#fbbf24]",
  ERROR: "text-[#f87171]",
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#ffaa00]/30 text-[#fbbf24] rounded-sm px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function LogPanel({ container, command }: Props) {
  const [lines, setLines] = useState<LogLine[]>(() =>
    Array.from({ length: 10 }, (_, i) => pickLog(i))
  );
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const counterRef = useRef(10);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  const addLine = useCallback(() => {
    if (pausedRef.current) return;
    const line = pickLog(counterRef.current++);
    setLines((prev) => [...prev.slice(-499), line]);
  }, []);

  useEffect(() => {
    const id = setInterval(addLine, 600 + Math.random() * 1400);
    return () => clearInterval(id);
  }, [addLine]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, paused]);

  const handleDownload = () => {
    const content = lines
      .map((l) => `[${l.time}] ${l.level.padEnd(5)} ${l.msg}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${container.serverName}-${container.name}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = search
    ? lines.filter(
        (l) =>
          l.msg.toLowerCase().includes(search.toLowerCase()) ||
          l.level.toLowerCase().includes(search.toLowerCase())
      )
    : lines;

  const isRunning = container.status === "running";

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border border-white/[0.08]"
      style={{ background: "#0b0b18" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", isRunning && "animate-pulse-glow")}
          style={{
            background: isRunning ? "#00ff88" : "#ff4444",
            boxShadow: isRunning ? "0 0 6px #00ff8888" : "0 0 6px #ff444488",
          }}
        />
        <span className="text-[10px] font-bold text-white/60 font-mono truncate flex-1">
          {container.serverName} / {container.name}
        </span>
        <span className="text-[9px] text-white/25 shrink-0 tabular-nums">CPU: {container.cpu}</span>
        <span className="text-[9px] text-white/25 shrink-0 tabular-nums ml-2">MEM: {container.ram}</span>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04] shrink-0"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <button
          onClick={() => setPaused((v) => !v)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all"
        >
          {paused ? (
            <Play size={9} className="text-[#00ff88]" />
          ) : (
            <Pause size={9} className="text-[#ffaa00]" />
          )}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => setLines([])}
          className="p-1 rounded border border-white/[0.08] text-white/30 hover:text-[#ff4444] hover:border-[#ff4444]/20 transition-all"
          title="Clear"
        >
          <Trash2 size={10} />
        </button>
        <button
          onClick={handleDownload}
          className="p-1 rounded border border-white/[0.08] text-white/30 hover:text-[#00d4ff] hover:border-[#00d4ff]/20 transition-all"
          title="Download"
        >
          <Download size={10} />
        </button>
        <div className="flex-1 relative ml-1">
          <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded text-[10px] text-white/60 pl-5 pr-5 py-0.5 outline-none transition-all font-mono border border-white/[0.06] focus:border-[#00d4ff]/20"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white"
            >
              <X size={9} />
            </button>
          )}
        </div>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2.5 custom-scrollbar"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}
      >
        {command && (
          <div
            className="text-[10px] mb-2 pb-2 border-b border-white/[0.04]"
            style={{ color: "rgba(0,212,255,0.5)" }}
          >
            $ {command}
          </div>
        )}
        {filtered.map((line) => {
          const dimmed = search && !line.msg.toLowerCase().includes(search.toLowerCase()) && !line.level.toLowerCase().includes(search.toLowerCase());
          return (
            <div
              key={line.id}
              className={cn(
                "flex gap-2 px-1 py-[1px] rounded hover:bg-white/[0.02] transition-colors text-[11px] leading-[1.65]",
                dimmed && "opacity-25"
              )}
            >
              <span className="text-white/20 shrink-0 tabular-nums">[{line.time}]</span>
              <span className={cn("font-bold shrink-0 w-11", LEVEL_CLASS[line.level])}>
                {line.level}
              </span>
              <span className="text-white/65 flex-1 break-all">
                <HighlightedText text={line.msg} query={search} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Trash2, Download, Terminal as TerminalIcon } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import { streamContainerLogs, stopLogStream } from "@/lib/tauri/commands";
import type { MockContainer } from "@/types/monitor";

interface Props {
  container: MockContainer;
  command: string;
}

export default function LogPanel({ container, command }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [paused, setPaused] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const pausedRef = useRef(false);
  const logHistoryRef = useRef<string[]>([]);

  pausedRef.current = paused;

  // Initialize Terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 11,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: "#0b0b18",
        foreground: "#a9b1d6",
        cursor: "#00d4ff",
        selectionBackground: "rgba(0, 212, 255, 0.3)",
        black: "#1a1b26",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      allowProposedApi: true,
      scrollback: 5000,
      rows: 20,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  // Handle Data Streaming
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const eventId = `logs-${container.serverId}-${container.name}-${Math.random().toString(36).slice(2)}`;

    const startStream = async () => {
      try {
        setIsStreaming(true);
        
        if (command && command !== "tail -f" && xtermRef.current) {
          xtermRef.current.writeln(`\r\n\x1b[1;36m>_ $ ${command}\x1b[0m`);
        }

        unlisten = await listen<{ line: string; done: boolean }>(eventId, (event) => {
          if (event.payload.done) {
             setIsStreaming(false);
             return;
          }
          
          logHistoryRef.current.push(event.payload.line);
          if (pausedRef.current) return;
          
          if (xtermRef.current) {
            // Write line to xterm
            xtermRef.current.writeln(event.payload.line);
          }
        });

        await streamContainerLogs({
          serverId: container.serverId,
          container: container.name,
          tail: 100,
          eventId,
          customCommand: command,
        });
      } catch (err) {
        console.error("Failed to stream logs:", err);
        if (xtermRef.current) {
          xtermRef.current.writeln(`\r\n\x1b[1;31m[System Error] ${err}\x1b[0m`);
        }
        setIsStreaming(false);
      }
    };

    startStream();

    return () => {
      if (unlisten) unlisten();
      stopLogStream(eventId).catch(console.error);
    };
  }, [container.serverId, container.name, command]);

  // Handle Resizing when container size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
    return () => clearTimeout(timer);
  }, [container]);

  const handleClear = () => {
    xtermRef.current?.clear();
    logHistoryRef.current = [];
  };

  const handleDownload = () => {
    const content = logHistoryRef.current.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${container.serverName}-${container.name}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border border-white/[0.08]"
      style={{ background: "#0b0b18" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", isStreaming && "animate-pulse-glow")}
          style={{
            background: isStreaming ? "#00ff88" : "#ff4444",
            boxShadow: isStreaming ? "0 0 6px #00ff8888" : "0 0 6px #ff444488",
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
          onClick={handleClear}
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
        
        <div className="flex-1" />

        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05]">
           <TerminalIcon size={10} className="text-[#00d4ff]/50" />
           <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">TTY Active</span>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative bg-[#0b0b18]">
        <div 
          ref={terminalRef} 
          className="absolute inset-0 p-2"
        />
        {!isStreaming && logHistoryRef.current.length === 0 && (
           <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10 pointer-events-none">
              <TerminalIcon size={48} className="mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Disconnected</span>
           </div>
        )}
      </div>
    </div>
  );
}

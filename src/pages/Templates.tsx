import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { GitBranch, RefreshCw, Loader2, FileText, FolderGit2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface TemplateConfig {
  git_url: string;
  git_branch: string;
}

interface TemplateFile {
  name: string;
  relative_path: string;
  size_bytes: number;
}

interface SyncLine {
  line: string;
  done: boolean;
  error: boolean;
}

const EVENT_ID = "template-sync";

export default function Templates() {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncError, setSyncError] = useState("");
  const [files, setFiles] = useState<TemplateFile[]>([]);

  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    invoke<TemplateConfig>("get_template_config").then((c) => {
      if (c.git_url) setUrl(c.git_url);
      if (c.git_branch) setBranch(c.git_branch);
    }).catch(() => {});
    loadFiles();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const loadFiles = async () => {
    try {
      const fs = await invoke<TemplateFile[]>("list_template_files");
      setFiles(fs);
    } catch {
      // ignore
    }
  };

  const handleSync = async () => {
    if (!url.trim()) return;

    setSyncing(true);
    setLogs([]);
    setSyncError("");

    try {
      await invoke("save_template_config", {
        gitUrl: url.trim(),
        gitBranch: branch.trim(),
      });
    } catch (e) {
      setSyncError(String(e));
      setSyncing(false);
      return;
    }

    const unlisten = await listen<SyncLine>(EVENT_ID, (ev) => {
      const { line, done } = ev.payload;
      if (line) setLogs((p) => [...p, line]);
      if (done) {
        setSyncing(false);
        loadFiles();
      }
    });

    try {
      await invoke("sync_git_templates", { eventId: EVENT_ID });
    } catch (e) {
      setSyncError(String(e));
      setSyncing(false);
    } finally {
      unlisten();
    }
  };

  const fmtSize = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-3xl mx-auto w-full">

        <div className="flex items-center gap-2 mb-6">
          <FolderGit2 size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Template Sync</h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/")}>
            ← Home
          </Button>
        </div>

        {/* Git config */}
        <div className="border rounded-lg p-4 space-y-3 mb-4">
          <h2 className="text-sm font-medium flex items-center gap-1.5">
            <GitBranch size={14} /> Git Repository
          </h2>

          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/org/vms-templates"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Branch</Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="h-8 text-sm w-40"
            />
          </div>

          <Button size="sm" onClick={handleSync} disabled={!url.trim() || syncing}>
            {syncing
              ? <Loader2 size={13} className="animate-spin mr-1" />
              : <RefreshCw size={13} className="mr-1" />}
            {syncing ? "Đang sync…" : "Sync"}
          </Button>
        </div>

        {/* Sync log */}
        {(logs.length > 0 || syncError) && (
          <div className="border rounded-lg mb-4 overflow-hidden">
            <div className="bg-muted/40 border-b px-3 py-1.5 text-xs font-medium">Output</div>
            <ScrollArea className="h-36">
              <pre
                ref={logRef}
                className="px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed"
              >
                {logs.join("\n")}
                {syncError && `\n[ERROR] ${syncError}`}
              </pre>
            </ScrollArea>
          </div>
        )}

        <Separator className="my-2" />

        {/* File list */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cached Templates
          </span>
          <span className="text-xs text-muted-foreground ml-auto">{files.length} files</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={loadFiles}>
            <RefreshCw size={10} />
          </Button>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Chưa có template. Cấu hình git URL và nhấn Sync.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="max-h-96">
              {files.map((f) => (
                <div
                  key={f.relative_path}
                  className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-xs hover:bg-muted/20"
                >
                  <FileText size={11} className="text-muted-foreground shrink-0" />
                  <span className="font-mono flex-1 truncate">{f.relative_path}</span>
                  <span className="text-muted-foreground text-[10px] shrink-0">
                    {fmtSize(f.size_bytes)}
                  </span>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

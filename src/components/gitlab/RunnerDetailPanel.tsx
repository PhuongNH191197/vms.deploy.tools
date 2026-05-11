import { useEffect, useState } from "react";
import { X, RefreshCw, ExternalLink, Loader2, Clock, Tag, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import type { GitLabRunnerDto } from "@/lib/tauri/gitlabRunner";

interface Props {
  runner: GitLabRunnerDto;
  onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    online:  { label: "Online",  cls: "bg-green-500/20 text-green-400 border-green-500/30" },
    running: { label: "Running", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    offline: { label: "Offline", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    unknown: { label: "Unknown", cls: "bg-white/10 text-white/40 border-white/15" },
  };
  const { label, cls } = map[status] ?? map.unknown;
  return (
    <span className={cn("px-2 py-0.5 rounded border text-xs font-medium", cls)}>
      {label}
    </span>
  );
}

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function RunnerDetailPanel({ runner, onClose }: Props) {
  const { runnerStatus, isLoadingStatus, checkRunnerStatus } = useGitLabRunnerStore();
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-check on open
    handleCheck();
  }, [runner.id]);

  const handleCheck = async () => {
    setCheckError(null);
    try {
      await checkRunnerStatus(runner.id);
    } catch (e) {
      setCheckError(String(e));
    }
  };

  const status = runnerStatus?.runner_id_local === runner.id
    ? runnerStatus.status
    : runner.status;

  const jobs = runnerStatus?.runner_id_local === runner.id
    ? runnerStatus.active_jobs
    : [];

  return (
    <div className="w-80 border-l border-white/10 bg-[#0a0f1e] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white truncate mr-2">
          {runner.runner_name}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/40 hover:text-white shrink-0"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Runner info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-white/60">
            <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="break-all text-xs">{runner.gitlab_url}</span>
          </div>
          {runner.tags && (
            <div className="flex items-start gap-2 text-white/60">
              <Tag className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {runner.tags.split(",").map((t) => (
                  <span key={t} className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/60">
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Clock className="w-3 h-3" />
            <span>Executor: {runner.executor}</span>
          </div>
          {runner.project_name && (
            <div className="text-xs text-white/40">Project: {runner.project_name}</div>
          )}
          <div className="text-xs text-white/30">Token: {runner.token_masked}</div>
        </div>

        {/* Status section */}
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 font-medium uppercase tracking-wide">Trạng thái</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoadingStatus}
              onClick={handleCheck}
              className="h-6 text-xs text-white/50 hover:text-white px-2"
            >
              {isLoadingStatus ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Kiểm tra
            </Button>
          </div>

          <StatusBadge status={status} />

          {runner.last_checked_at && (
            <div className="text-xs text-white/30">
              Checked: {new Date(runner.last_checked_at + "Z").toLocaleString("vi-VN")}
            </div>
          )}

          {checkError && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
              {checkError}
            </div>
          )}
        </div>

        {/* Active jobs */}
        {jobs.length > 0 && (
          <div className="border-t border-white/10 pt-3 space-y-2">
            <span className="text-xs text-white/40 font-medium uppercase tracking-wide">
              Jobs đang chạy ({jobs.length})
            </span>
            {jobs.map((job) => (
              <div
                key={job.job_id}
                className="bg-white/5 rounded p-2.5 space-y-1 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white/80 font-medium truncate">{job.job_name}</span>
                  {job.web_url && (
                    <a
                      href={job.web_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-white/40">
                  Pipeline #{job.pipeline_id} · {job.branch}
                </div>
                <div className="text-white/30">
                  Duration: {formatDuration(job.duration_secs)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Server info */}
        <div className="border-t border-white/10 pt-3">
          <div className="text-xs text-white/30 space-y-1">
            <div>Server: {runner.server_name}</div>
            <div>Created: {new Date(runner.created_at).toLocaleDateString("vi-VN")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GitLabRunnerDto } from "@/lib/tauri/gitlabRunner";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";

interface Props {
  runners: GitLabRunnerDto[];
  isLoading: boolean;
  onSelectRunner: (r: GitLabRunnerDto) => void;
  onDeleteRunner: (id: number) => void;
}

function StatusBadge({ status }: { status: GitLabRunnerDto["status"] }) {
  switch (status) {
    case "online":
      return (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Online
        </span>
      );
    case "running":
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-400">
          <Zap className="w-3 h-3" />
          Running
        </span>
      );
    case "offline":
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          Offline
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-white/30">
          <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />
          Unknown
        </span>
      );
  }
}

export default function RunnerTable({ runners, isLoading, onSelectRunner, onDeleteRunner }: Props) {
  const { selectedRunner } = useGitLabRunnerStore();

  if (isLoading && runners.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        Đang tải...
      </div>
    );
  }

  if (runners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/30">
        <p className="text-sm">Chưa có runner nào.</p>
        <p className="text-xs">Nhấn [Scan] để tìm runner trên server, hoặc [+ Add Runner] để cài mới.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-white/40 text-xs border-b border-white/10">
          <th className="px-4 py-2.5 font-medium w-24">Trạng thái</th>
          <th className="px-4 py-2.5 font-medium">Tên Runner</th>
          <th className="px-4 py-2.5 font-medium">Server</th>
          <th className="px-4 py-2.5 font-medium">Project</th>
          <th className="px-4 py-2.5 font-medium">Tags</th>
          <th className="px-4 py-2.5 font-medium w-24">Job gần nhất</th>
          <th className="px-4 py-2.5 font-medium w-16" />
        </tr>
      </thead>
      <tbody>
        {runners.map((r) => (
          <tr
            key={r.id}
            onClick={() => onSelectRunner(r)}
            className={cn(
              "border-b border-white/5 cursor-pointer transition-colors hover:bg-white/[0.04]",
              selectedRunner?.id === r.id && "bg-blue-500/10 border-blue-500/20"
            )}
          >
            <td className="px-4 py-2.5">
              <StatusBadge status={r.status} />
            </td>
            <td className="px-4 py-2.5">
              <div className="text-white/90 font-medium">{r.runner_name}</div>
              <div className="text-white/30 text-xs">{r.executor}</div>
            </td>
            <td className="px-4 py-2.5 text-white/60">{r.server_name}</td>
            <td className="px-4 py-2.5">
              {r.project_name ? (
                <span className="text-white/70">{r.project_name}</span>
              ) : (
                <span className="text-white/20 italic text-xs">—</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              {r.tags ? (
                <div className="flex flex-wrap gap-1">
                  {r.tags.split(",").map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/60"
                    >
                      {t.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-white/20 text-xs">—</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              {r.last_job_status ? (
                <span
                  className={cn(
                    "text-xs",
                    r.last_job_status === "success" && "text-green-400",
                    r.last_job_status === "failed" && "text-red-400",
                    r.last_job_status === "running" && "text-yellow-400",
                  )}
                >
                  {r.last_job_status}
                </span>
              ) : (
                <span className="text-white/20 text-xs">—</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/30 hover:text-red-400 hover:bg-red-400/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRunner(r.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

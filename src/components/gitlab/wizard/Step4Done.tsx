import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  serverName: string;
  runnerName: string;
  tags: string;
  gitlabUrl: string;
  onDone: () => void;
}

export default function Step4Done({ serverName, runnerName, tags, gitlabUrl, onDone }: Props) {
  return (
    <div className="flex flex-col items-center py-6 space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Runner đã được cấu hình thành công!</h3>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between text-white/60">
          <span>Server</span>
          <span className="text-white/90">{serverName}</span>
        </div>
        <div className="flex justify-between text-white/60">
          <span>Runner Name</span>
          <span className="text-white/90">{runnerName}</span>
        </div>
        {tags && (
          <div className="flex justify-between text-white/60">
            <span>Tags</span>
            <span className="text-white/90">{tags}</span>
          </div>
        )}
        <div className="flex justify-between text-white/60">
          <span>GitLab</span>
          <span className="text-white/90 truncate max-w-[200px]">{gitlabUrl}</span>
        </div>
      </div>

      <Button
        className="bg-blue-600 hover:bg-blue-700 text-white px-8"
        onClick={onDone}
      >
        Xem danh sách runner
      </Button>
    </div>
  );
}

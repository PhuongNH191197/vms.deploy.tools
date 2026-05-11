import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import { useServerStore } from "@/store/serverStore";
import { cn } from "@/lib/utils";

interface Props {
  onDone: () => void;
}

export default function Step4BatchDone({ onDone }: Props) {
  const {
    batchSelectedServerIds,
    batchInstallResults,
    batchRegisterResults,
    batchGitAuthResults,
    openBatchWizard,
    setBatchSelectedServers,
  } = useGitLabRunnerStore();

  const { servers } = useServerStore();
  const getServerName = (id: string) => {
    const fromInstall = batchInstallResults.find((r) => r.server_id === id)?.server_name;
    const fromRegister = batchRegisterResults.find((r) => r.server_id === id)?.server_name;
    const fromAuth = batchGitAuthResults.find((r) => r.server_id === id)?.server_name;
    return fromInstall ?? fromRegister ?? fromAuth ?? servers.find((s) => s.id === id)?.name ?? id;
  };

  const rows = batchSelectedServerIds.map((id) => {
    const install = batchInstallResults.find((r) => r.server_id === id);
    const register = batchRegisterResults.find((r) => r.server_id === id);
    const auth = batchGitAuthResults.find((r) => r.server_id === id);
    const allOk = (!install || install.success) && (!register || register.success) && (!auth || auth.success);
    return { id, name: getServerName(id), install, register, auth, allOk };
  });

  const failedIds = rows.filter((r) => !r.allOk).map((r) => r.id);

  const handleRetryFailed = () => {
    setBatchSelectedServers(failedIds);
    openBatchWizard();
  };

  const StatusCell = ({ ok }: { ok: boolean | undefined }) => {
    if (ok === undefined) return <span className="text-white/20">—</span>;
    return ok ? (
      <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400 mx-auto" />
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-blue-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Hoàn tất cài đặt batch</h3>
        <p className="text-sm text-white/40">
          {rows.filter((r) => r.allOk).length}/{rows.length} server thành công
        </p>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-white/40 border-b border-white/10">
              <th className="py-1.5 px-2 text-left">Server</th>
              <th className="py-1.5 px-2 text-center">Install</th>
              <th className="py-1.5 px-2 text-center">Register</th>
              <th className="py-1.5 px-2 text-center">Git Auth</th>
              <th className="py-1.5 px-2 text-center">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-white/5",
                  row.allOk ? "text-white/70" : "text-white/50"
                )}
              >
                <td className="py-1.5 px-2">{row.name}</td>
                <td className="py-1.5 px-2 text-center">
                  <StatusCell ok={row.install?.success} />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <StatusCell ok={row.register?.success} />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <StatusCell ok={row.auth?.success} />
                </td>
                <td className="py-1.5 px-2 text-center">
                  {row.allOk ? (
                    <span className="text-xs text-green-400">✅ OK</span>
                  ) : (
                    <span className="text-xs text-red-400">❌ Fail</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between pt-2">
        {failedIds.length > 0 && (
          <Button
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={handleRetryFailed}
          >
            Thử lại {failedIds.length} server lỗi
          </Button>
        )}
        <div className="flex-1" />
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onDone}
        >
          Xem danh sách runner
        </Button>
      </div>
    </div>
  );
}

import { ReactNode, useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import bgImage from "@/assets/bg.png";
import { GlowBackground } from "./GlowBackground";
import { useLocation } from "react-router-dom";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const mainElement = document.getElementById('main-content');
    const handleScroll = () => {
      setScrollOffset(mainElement?.scrollTop ?? 0);
    };
    mainElement?.addEventListener('scroll', handleScroll);
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, []);

  // Tính toán độ mờ và màu sắc dựa trên scroll (từ 0 đến 100px)
  const opacity = Math.min(scrollOffset / 100, 0.85);
  const blur = Math.min(scrollOffset / 5, 20);

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/":
      case "/dashboard":
        return "Infrastructure Overview";
      case "/projects":
        return "Projects & Environments";
      case "/bulk-deploy":
        return "Bulk Deploy";
      case "/update":
        return "Deployments & Releases";
      case "/setup":
        return "Deploy Wizard & Infrastructure";
      case "/monitor":
        return "Real-time System Monitoring";
      case "/audit":
        return "Security & Operation Logs";
      case "/gitlab-runner":
        return "GitLab Runner Management";
      default:
        return "Infrastructure Overview";
    }
  };

  return (
    <div
      className="h-screen w-screen p-6 overflow-hidden font-sans relative"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ── Hệ thống vân mây vật lý (Va chạm & Full Background) ── */}
      <GlowBackground />

      {/* ── Main App Container (Bo tròn & Có độ sâu) ── */}
      <div
        className="h-full w-full rounded-l-[2.5rem] rounded-r-[0.8rem] overflow-hidden flex relative z-10"
        style={{
          background: "rgba(10, 18, 36, 0.45)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: [
            /* Outer depth: nhiều lớp shadow đen */
            "0 0 0 1px rgba(0,0,0,0.6)",
            "0 20px 60px rgba(0,0,0,0.7)",
            "0 40px 120px rgba(0,0,0,0.5)",
            "0 80px 200px rgba(0,0,0,0.3)",
            /* Neon accent glow nhẹ */
            "0 0 80px rgba(0,200,255,0.04)",
            /* Inner top highlight — tạo hiệu ứng rim light */
            "inset 0 1px 0 rgba(255,255,255,0.08)",
            "inset 0 -1px 0 rgba(0,0,0,0.3)",
          ].join(", "),
        }}
      >
        <Sidebar />

        <main 
          id="main-content"
          className="flex-1 flex flex-col overflow-y-auto relative custom-scrollbar"
        >
          {/* ── Header (Sticky + Dynamic) ── */}
          <header 
            className="px-20 pt-10 pb-6 sticky top-0 z-30 flex justify-between items-end transition-all duration-500 ease-out -mx-10"
            style={{ 
              backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
              backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
              WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
              zIndex: -999,
            }}
          >
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-white leading-none uppercase">
                {getPageTitle(location.pathname)}
              </h1>
            </div>

            {isDashboard && (
              <Button
                variant="ghost"
                className="btn-ghost-glass gap-2 rounded-xl px-5 h-10 text-[11px] font-black uppercase tracking-widest border-white/5 opacity-60 hover:opacity-100"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={14} className="text-df-cyan" />
                Synchronize
              </Button>
            )}
          </header>

          {/* ── Content ── */}
          <div className="flex-1 px-10 py-2 relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

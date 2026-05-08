import React, { useEffect, useRef, useState } from "react";

interface Blob {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

const COLORS = [
  "rgba(49, 232, 255, 0.5)",   // Cyan
  "rgba(236, 72, 153, 0.4)",   // Pink
  "rgba(99, 102, 241, 0.4)",   // Indigo
  "rgba(16, 185, 129, 0.35)",  // Emerald
  "rgba(249, 115, 22, 0.4)",   // Orange
  "rgba(168, 85, 247, 0.45)",  // Purple
  "rgba(132, 204, 22, 0.3)",   // Lime
  "rgba(20, 184, 166, 0.3)",   // Teal
  "rgba(244, 63, 94, 0.4)",    // Rose
  "rgba(14, 165, 233, 0.4)",   // Sky
  "rgba(168, 85, 247, 0.5)",   // Violet
  "rgba(234, 179, 8, 0.25)",   // Yellow
];

export const GlowBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const requestRef = useRef<number | null>(null);

  // Khởi tạo blobs
  useEffect(() => {
    const initialBlobs: Blob[] = COLORS.map((color, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 2, // Tốc độ nhanh hơn
      vy: (Math.random() - 0.5) * 2,
      radius: 300 + Math.random() * 400,
      color,
    }));
    setBlobs(initialBlobs);
  }, []);

  const update = () => {
    setBlobs((prevBlobs) => {
      const newBlobs = [...prevBlobs];
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 1. Cập nhật vị trí và va chạm tường
      for (let i = 0; i < newBlobs.length; i++) {
        const b = newBlobs[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -b.radius / 2) b.vx = Math.abs(b.vx);
        if (b.x > width + b.radius / 2) b.vx = -Math.abs(b.vx);
        if (b.y < -b.radius / 2) b.vy = Math.abs(b.vy);
        if (b.y > height + b.radius / 2) b.vy = -Math.abs(b.vy);

        // 2. Kiểm tra va chạm với các blob khác (đơn giản hóa)
        for (let j = i + 1; j < newBlobs.length; j++) {
          const b2 = newBlobs[j];
          const dx = b2.x - b.x;
          const dy = b2.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (b.radius + b2.radius) / 4; // Khoảng cách va chạm ảo

          if (distance < minDistance) {
            // Đổi hướng khi va chạm
            const tempVx = b.vx;
            const tempVy = b.vy;
            b.vx = b2.vx;
            b.vy = b2.vy;
            b2.vx = tempVx;
            b2.vy = tempVy;
          }
        }
      }
      return newBlobs;
    });
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 filter blur-[80px] opacity-70">
        {blobs.map((blob) => (
          <div
            key={blob.id}
            className="absolute rounded-full transition-transform duration-1000 ease-linear"
            style={{
              width: blob.radius,
              height: blob.radius,
              left: blob.x - blob.radius / 2,
              top: blob.y - blob.radius / 2,
              background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
              transform: "translate3d(0,0,0)", // Tăng tốc GPU
            }}
          />
        ))}
      </div>
    </div>
  );
};

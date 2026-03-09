// ============================================
// app/rooms/layout.tsx
// ============================================
import '../globals.css';

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rooms-layout-container">
      <div className="rooms-layout-inner">
        {children}
      </div>
    </div>
  );
}
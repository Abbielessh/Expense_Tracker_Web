import type { ReactNode } from 'react';

export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 md:items-center md:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[28px] bg-white p-5 shadow-2xl md:max-w-lg md:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-[#101828]">{title}</h2>
          <button className="outline-btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

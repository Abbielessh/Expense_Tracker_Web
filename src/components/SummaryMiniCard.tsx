export default function SummaryMiniCard({ title, value, tone = 'blue' }: { title: string; value: string; tone?: 'blue' | 'green' | 'red' | 'orange' | 'purple' }) {
  const color = {
    blue: 'text-[#2563EB]',
    green: 'text-[#059669]',
    red: 'text-[#DC2626]',
    orange: 'text-[#EA580C]',
    purple: 'text-[#7C3AED]'
  }[tone];
  return (
    <div className="rounded-[18px] bg-[#F7FAFF] p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-[13px] text-[#667085]">{title}</p>
      <p className={`mt-1 text-lg font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

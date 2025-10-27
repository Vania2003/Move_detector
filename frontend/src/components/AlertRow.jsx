export default function AlertRow({ a }) {
  const pill =
    a.status === 'open'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  return (
    <tr className="border-b border-neutral-900">
      <td className="py-2 pr-4">{a.id}</td>
      <td className="py-2 pr-4">{a.ts_utc}</td>
      <td className="py-2 pr-4">{a.room ?? '—'}</td>
      <td className="py-2 pr-4">{a.device_id ?? '—'}</td>
      <td className="py-2 pr-4">{a.type}</td>
      <td className="py-2 pr-4">
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${pill}`}>
          {a.status}
        </span>
      </td>
      <td className="py-2">{a.details ?? ''}</td>
    </tr>
  )
}

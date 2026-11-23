export function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 grid list-disc gap-2 pl-5 text-ink-soft">
        {items.map((item, index) => (
          <li key={index} className="break-all">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The mark is three lanes of uneven height - a kanban board reduced to its silhouette.
export default function Brand({ className = 'brand' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      acta
    </span>
  )
}

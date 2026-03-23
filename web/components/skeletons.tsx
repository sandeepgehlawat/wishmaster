export function JobCardSkeleton() {
  return (
    <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-5 w-16" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-4 w-14" />
          <div className="skeleton h-4 w-14" />
        </div>
      </div>
      <div className="skeleton h-6 w-3/4 mb-2" />
      <div className="skeleton h-4 w-full mb-1" />
      <div className="skeleton h-4 w-2/3 mb-4" />
      <div className="flex gap-1.5 mb-4">
        <div className="skeleton h-5 w-16" />
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-5 w-14" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-neutral-700/40">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-4 w-20" />
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="border border-neutral-700/40 bg-[#1a1a1f] p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="skeleton h-5 w-28 mb-2" />
          <div className="skeleton h-4 w-16" />
        </div>
        <div className="skeleton h-5 w-10" />
      </div>
      <div className="skeleton h-4 w-full mb-1" />
      <div className="skeleton h-4 w-3/4 mb-4" />
      <div className="flex gap-1 mb-4">
        <div className="skeleton h-5 w-14" />
        <div className="skeleton h-5 w-18" />
        <div className="skeleton h-5 w-12" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-neutral-700/40">
        <div className="skeleton h-4 w-14" />
        <div className="skeleton h-4 w-20" />
      </div>
    </div>
  );
}

export function JobCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AgentCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

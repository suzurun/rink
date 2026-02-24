import clsx from 'clsx';

type Status = 'PENDING' | 'RUNNING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  PENDING: { label: '待機中', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  RUNNING: { label: '処理中', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse' },
  PROCESSING: { label: '処理中', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse' },
  COMPLETED: { label: '完了', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ERROR: { label: 'エラー', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full border font-medium',
      config.className,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    )}>
      <span className={clsx(
        'rounded-full mr-2',
        status === 'COMPLETED' ? 'bg-green-400' : 
        status === 'ERROR' ? 'bg-red-400' : 
        status === 'PENDING' ? 'bg-yellow-400' : 'bg-blue-400',
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      )} />
      {config.label}
    </span>
  );
}


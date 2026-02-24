import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ 
  children, 
  className, 
  hover = false,
  padding = 'md' 
}: CardProps) {
  return (
    <div className={clsx(
      'glass rounded-2xl',
      hover && 'card-hover cursor-pointer',
      padding === 'sm' && 'p-4',
      padding === 'md' && 'p-6',
      padding === 'lg' && 'p-8',
      padding === 'none' && '',
      className
    )}>
      {children}
    </div>
  );
}


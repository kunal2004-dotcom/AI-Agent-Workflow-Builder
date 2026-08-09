import React from 'react';

interface Props {
  quota_used: number;
  quota_limit: number;
  quota_reset_at: string;
  compact?: boolean;
}

export default function QuotaIndicator({ quota_used, quota_limit, quota_reset_at, compact }: Props) {
  const percentage = Math.min((quota_used / quota_limit) * 100, 100) || 0;
  let colorClass = 'bg-green-500';
  if (percentage >= 90) colorClass = 'bg-red-500';
  else if (percentage >= 70) colorClass = 'bg-yellow-500';

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1 text-xs">
        <div className="text-gray-500">{quota_used} / {quota_limit} runs</div>
        <div className="quota-bar w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`quota-bar-fill h-full ${colorClass}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Quota Usage</h3>
        <span className="text-sm text-gray-500">Resets {new Date(quota_reset_at).toLocaleDateString()}</span>
      </div>
      <div className="quota-bar w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`quota-bar-fill h-full ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="text-sm text-right text-gray-600">
        {quota_used} / {quota_limit} runs used
      </div>
    </div>
  );
}

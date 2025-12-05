import React from 'react';

interface StatusIconProps {
  status?: 'Created' | 'Posted' | string;
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  let colorClass: string;
  let title: string;

  if (status === 'Posted') {
    colorClass = 'bg-green-500';
    title = 'Status: Postado';
  } else {
    colorClass = 'bg-red-500';
    title = 'Status: Não Postado';
  }

  return (
    <div
      className={`w-3 h-3 rounded-full ${colorClass} border-2 border-white/50 shadow-md`}
      title={title}
    />
  );
};

export default StatusIcon;

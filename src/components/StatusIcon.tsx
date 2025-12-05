import React from 'react';

interface StatusIconProps {
  status?: 'Created' | 'Posted' | 'Scheduled' | string;
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  let colorClass: string;
  let title: string;

  if (status === 'Posted') {
    colorClass = 'bg-green-500';
    title = 'Status: Postado';
  } else if (status === 'Scheduled') {
    colorClass = 'bg-blue-500';
    title = 'Status: Agendado';
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

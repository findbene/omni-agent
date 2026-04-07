import React from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  if (!message) return null;
  return (
    <div className={`omni-toast ${visible ? 'omni-toast-enter' : 'omni-toast-exit'}`}>
      {message}
    </div>
  );
}

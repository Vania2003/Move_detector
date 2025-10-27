import React from 'react';

export default function Spinner({ size = 16 }) {
  return (
    <div className="inline-block animate-spin rounded-full border-2 border-zinc-600 border-t-transparent"
         style={{ width: size, height: size }}/>
  );
}

import React from 'react';
import { renderToString } from 'react-dom/server';
import { Icon } from './src/shared/components/ui/Icon';

const iconMarkup = renderToString(
  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-green-500/10 border-green-500/20">
    <Icon name="Server" size={14} className="text-green-400" />
  </div>
);

console.log(iconMarkup);

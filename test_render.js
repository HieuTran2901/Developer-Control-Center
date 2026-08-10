const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const Dashboard = () => {
  return React.createElement('div', { className: 'w-8 h-8 rounded-md flex items-center justify-center shrink-0' }, 
    React.createElement('svg', { width: 14, height: 14 }, React.createElement('path', { d: 'M1 1h12v12H1z' }))
  );
};
console.log(renderToStaticMarkup(React.createElement(Dashboard)));

const React = require('react');
const {View} = require('react-native');

const MapViewMock = ({children, ...props}) =>
  React.createElement(View, props, children);
const Marker = props => React.createElement(View, props);
const Circle = props => React.createElement(View, props);

module.exports = MapViewMock;
module.exports.default = MapViewMock;
module.exports.Marker = Marker;
module.exports.Circle = Circle;
module.exports.PROVIDER_GOOGLE = 'google';

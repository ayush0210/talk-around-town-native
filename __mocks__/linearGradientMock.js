const React = require('react');
const {View} = require('react-native');

const LinearGradientMock = ({children, ...props}) =>
  React.createElement(View, props, children);

module.exports = LinearGradientMock;
module.exports.default = LinearGradientMock;

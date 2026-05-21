const React = require('react');
const {Text} = require('react-native');

const IconMock = props => React.createElement(Text, props, props.name || '');

module.exports = IconMock;
module.exports.default = IconMock;

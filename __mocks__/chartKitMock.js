const React = require('react');
const {View} = require('react-native');

const ChartMock = props => React.createElement(View, props);

module.exports = {
  LineChart: ChartMock,
  BarChart: ChartMock,
  PieChart: ChartMock,
};

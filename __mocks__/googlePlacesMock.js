const React = require('react');
const {TextInput} = require('react-native');

const GooglePlacesAutocomplete = React.forwardRef((props, ref) =>
  React.createElement(TextInput, {...props, ref}),
);

module.exports = {
  GooglePlacesAutocomplete,
};

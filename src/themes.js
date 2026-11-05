export const themes = {
  mint: { id: 'mint', name: 'Mint Terminal', description: 'Original mint / deep charcoal', accent: '139,244,216', ink: '216,234,230',
    background: '#0b1114', band: '#102124', surface: '#0a1416', trace: '111,169,158', muted: '#688c7d' },
  paper: { id: 'paper', name: 'Silver Stream', description: 'Silver text / pale pink streams', accent: '232,190,216', ink: '247,244,234',
    background: '#090a0d', band: '#131216', surface: '#0d0d11', trace: '216,207,217', muted: '#9b929f' },
  white: { id: 'white', name: 'White Signal', description: 'White / silver / gray on charcoal', accent: '235,235,235', ink: '255,255,255',
    background: '#08090a', band: '#151617', surface: '#0e0f10', trace: '160,160,160', muted: '#9c9c9c' },
};
export const themeFor = value => themes[value] || themes.mint;
export const rgb = value => value.split(',').map(channel => Number(channel) / 255);
export const hexRGB = value => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);

module.exports = {
  plugins: process.env.NODE_ENV === 'production'
    ? { cssnano: { preset: 'default' } }
    : {},
};

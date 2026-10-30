// Keep VitePress independent of the legacy plugin repository's root PostCSS settings.
// This file stops configuration discovery from loading postcss-nesting/autoprefixer.
module.exports = { plugins: {} }

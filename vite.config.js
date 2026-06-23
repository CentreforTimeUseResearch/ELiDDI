import { execSync } from 'child_process'

export default {
  plugins: [
    {
      name: 'run-custom-script',
      transformIndexHtml(html) {
        const output = execSync('node scripts/generate_no_js.js').toString().trim()
        return html.replace('__GENERATED__', output)
      }
    }
  ],
  test: {
    environment: 'jsdom',
  },
}
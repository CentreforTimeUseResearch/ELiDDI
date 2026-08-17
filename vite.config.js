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
    // 1. Switch pool type to forks to prevent hanging worker threads
    pool: 'forks',

    // 2. Increase the global test timeout limit (in milliseconds)
    testTimeout: 20000,

    // 3. Optional: Increase the hook timeout limit (e.g., beforeEach/afterEach)
    hookTimeout: 20000,
  },
}
module.exports = {
  chromeLaunchConfig: {
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox']
  },
  level: 'error',
  timeout: 60000
};
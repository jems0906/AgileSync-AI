module.exports = {
  defaults: {
    chromeLaunchConfig: {
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox']
    }
  },
  urls: []
};
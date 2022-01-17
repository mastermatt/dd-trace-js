const tracer = require('../packages/dd-trace')
const { ORIGIN_KEY } = require('../packages/dd-trace/src/constants')

tracer.init({
  startupLogs: false,
  tags: {
    [ORIGIN_KEY]: 'ciapp-test'
  }
})

tracer.use('fs', false)

module.exports = tracer

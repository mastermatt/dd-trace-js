'use strict'

const {
  channel,
  addHook,
  AsyncResource
} = require('./helpers/instrument')
const shimmer = require('../../datadog-shimmer')

const producerStartCh = channel('apm:kafkajs:produce:start')
const producerMessageCh = channel(`apm:kafkajs:produce:message`)
const producerFinishCh = channel('apm:kafkajs:produce:finish')
const producerErrorCh = channel('apm:kafkajs:produce:error')

const consumerStartCh = channel('apm:kafkajs:consume:start')
const consumerFinishCh = channel('apm:kafkajs:consume:finish')
const consumerErrorCh = channel('apm:kafkajs:consume:error')

addHook({ name: 'kafkajs', versions: ['>=1.4'] }, (obj) => {
  const Kafka = obj.Kafka
  shimmer.wrap(Kafka.prototype, 'producer', createProducer => function () {
    if (!producerStartCh.hasSubscribers) {
      return createProducer.apply(this, arguments)
    }
    const producer = createProducer.apply(this, arguments)
    const send = producer.send

    const outerAsyncResource = new AsyncResource('bound-anonymous-fn')
    const innerAsyncResource = new AsyncResource('bound-anonymous-fn')

    producer.send = function () {
      return innerAsyncResource.runInAsyncScope(() => {
        producerStartCh.publish(undefined)
        try {
          const lastArgId = arguments.length - 1
          const cb = arguments[lastArgId]
          if (typeof cb === 'function') {
            const scopeBoundCb = outerAsyncResource.bind(cb)
            arguments[lastArgId] = innerAsyncResource.bind(function (err) {
              if (err) {
                producerErrorCh.publish(err)
              }
              producerFinishCh.publish(undefined)
              return scopeBoundCb.apply(this, arguments)
            })
          }
          const { topic, messages = [] } = arguments[0]
          for (const message of messages) {
            message.headers = message.headers || {}
          }
          producerMessageCh.publish({ topic, messages })

          const result = send.apply(this, arguments)

          return result
        } catch (e) {
          producerErrorCh.publish(e)
          producerFinishCh.publish(undefined)
          throw e
        } finally {
          producerFinishCh.publish(undefined)
        }
      })
    }
    return producer
  })

  shimmer.wrap(Kafka.prototype, 'consumer', createConsumer => function () {
    if (!consumerStartCh.hasSubscribers) {
      return createConsumer.apply(this, arguments)
    }

    const consumer = createConsumer.apply(this, arguments)
    const run = consumer.run

    consumer.run = function ({ eachMessage, ...runArgs }) {
      if (typeof eachMessage !== 'function') return run({ eachMessage, ...runArgs })

      return run({
        eachMessage: function () {
          const innerAsyncResource = new AsyncResource('bound-anonymous-fn')
          return innerAsyncResource.runInAsyncScope(() => {
            const { topic, partition, message } = arguments[0]
            consumerStartCh.publish({ topic, partition, message })
            try {
              const result = eachMessage.apply(this, arguments)

              if (result && typeof result.then === 'function') {
                result.then(
                  innerAsyncResource.bind(() => consumerFinishCh.publish(undefined)),
                  innerAsyncResource.bind(err => {
                    consumerErrorCh.publish(err)
                    consumerFinishCh.publish(undefined)
                  })
                )
              } else {
                consumerFinishCh.publish(undefined)
              }

              return result
            } catch (e) {
              consumerErrorCh.publish(e)
              consumerFinishCh.publish(undefined)
              throw e
            }
          })
        },
        ...runArgs
      })
    }
    return consumer
  })
  return obj
})

export default (): Record<string, any> => ({
  provider: process.env.PROVIDER,
  prefix: process.env.PREFIX,
  port: parseInt(process.env.PORT, 10) || 3000,
  microservicePort: parseInt(process.env.TCP_PORT, 10) || 3001,
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },
  database: {
    host: process.env.MONGODB_URI,
    options: {
      dbName: process.env.DB_NAME,
      w: 'majority',
    },
  },
})

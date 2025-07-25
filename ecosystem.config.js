module.exports = {
  apps: [{
    name: 'outlet-media-bot',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    
    // Restart settings
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Health monitoring
    cron_restart: '0 2 * * *', // Restart daily at 2 AM
    
    // Memory optimization
    node_args: '--max-old-space-size=1024',
    
    // Cluster mode (if needed later)
    exec_mode: 'fork',
  }]
};
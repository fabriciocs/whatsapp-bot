module.exports = {
    apps: [{
        name: 'runner-whats',
        script: './dist/client.js',
        watch: false,
        listen_timeout: 10000
    }],
};

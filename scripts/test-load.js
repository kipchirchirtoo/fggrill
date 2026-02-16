try {
    console.log('--- Testing powersync.js load ---');

    // Mock electron before requiring powersync
    const module = require('module');
    const originalRequire = module.prototype.require;
    module.prototype.require = function (name) {
        if (name === 'electron') {
            return {
                app: {
                    getPath: () => './test-data',
                    isPackaged: false
                }
            };
        }
        return originalRequire.apply(this, arguments);
    };

    const ps = require('../electron/powersync');
    console.log('SUCCESS: powersync.js loaded');
    console.log('Schema tables:', ps.schema.tables.map(t => t.name));
} catch (err) {
    console.error('FAILURE: Could not load powersync.js');
    console.error(err);
}

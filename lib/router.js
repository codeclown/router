'use strict';

const Route = require('route-parser');
const createHistory = require('history').createHistory;

function Router() {}

Router.prototype.setRoutes = function(routes) {
    this.routes = Router.flattenRouteHash(routes);
};

Router.prototype.parseRoute = function(pathname) {
    for(let path in this.routes) {
        const route = new Route(path);
        const params = route.match(pathname);

        if(params !== false) {
            let queue = Promise.resolve();

            if(this.routes[path].before) {
                for(let i = 0; i < this.routes[path].before.length; i++) {
                    queue = queue.then(() => this.routes[path].before[i](params));
                }
            }

            queue = queue.then(() => this.routes[path].handler(params));

            if(this.afterParse) queue = queue.then(this.afterParse);

            return queue;
        }
    }
};

Router.prototype.setAfterParse = function(afterParse) {
    this.afterParse = afterParse;
};

Router.prototype.listen = function() {
    this.history = createHistory();

    history.listen(location => {
        this.parseRoute(location.pathname);
    });
};

Router.normalizePath = path => path
    .replace(/\/+/g, '/') // Ensure no consecutive slashes
    .replace(/^([^\/])/, '/$1') // Ensure leading slash
    .replace(/(.+)\/$/, '$1'); // Ensure no trailing slash

Router.flattenRouteHash = hash => {
    const flattened = {};

    const hooks = { before: [] };

    const recursive = (item, prefix) => {
        for(let route in item) {
            if(!item.hasOwnProperty(route)) continue;

            // Path definition
            if(route.indexOf('/') === 0) {
                if(typeof item[route] === 'function') {
                    flattened[Router.normalizePath(prefix + route)] = { handler: item[route] };
                } else {
                    recursive(item[route], prefix + route);
                }
            }

            // Hook
            else if(route === 'before') {
                hooks[route][hooks[route].length] = { path: Router.normalizePath(prefix), hookFunction: item[route] };
            }
        }
    };

    recursive(hash, '');

    applyBefore(flattened, hooks.before);

    return flattened;
};

const applyBefore = (flattened, hooks) => {
    hooks.sort((a, b) => a.path.length < b.path.length ? -1 : 1);

    for(let route in flattened) {
        for(let i = 0; i < hooks.length; i++) {
            if(route.indexOf(hooks[i].path) === 0) {
                if(!flattened[route].before) {
                    flattened[route].before = [];
                }

                flattened[route].before[flattened[route].before.length] = hooks[i].hookFunction;
            }
        }
    }
};

module.exports = Router;

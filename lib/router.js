'use strict';

const Route = require('route-parser');
const createHistory = require('history').createHistory;

function Router(options) {
    this.notFoundHandlers = [];
    this.currentRoute = null;
}

Router.prototype.setRoutes = function(routes) {
    this.routes = Router.flattenRouteHash(routes, this.notFoundHandlers);
};

Router.prototype.parseRoute = function(pathname) {
    for(let path in this.routes) {
        const route = new Route(path);
        const params = route.match(pathname);

        if(params !== false) {
            const previousRoute = this.currentRoute;
            this.currentRoute = this.routes[path];

            let queue = Promise.resolve();

            if(previousRoute && previousRoute.after) {
                const hooks = [].concat(previousRoute.after);

                // Filter out the hooks shared with next route
                if(this.currentRoute.after) {
                    const currentHooks = [].concat(this.currentRoute.after);

                    for(let i = 0; i < hooks.length; i++) {
                        const index = hooks.indexOf(currentHooks[i]);

                        if(index < 0 || index !== i) {
                            break;
                        }

                        hooks.shift();
                        currentHooks.shift();
                        i--;
                    }
                }

                for(let i = 0; i < hooks.length; i++) {
                    queue = queue.then(() => hooks[i]());
                }
            }

            if(this.currentRoute.before) {
                for(let i = 0; i < this.currentRoute.before.length; i++) {
                    queue = queue.then(() => this.currentRoute.before[i](params));
                }
            }

            queue = queue.then(() => this.currentRoute.handler(params));

            if(this.currentRoute.render) {
                for(let i = 0; i < this.currentRoute.render.length; i++) {
                    queue = queue.then(this.currentRoute.render[i]);
                }
            }

            return Promise.resolve(queue);
        }
    }

    this.notFoundHandlers.sort((a, b) => a.path.length > b.path.length ? -1 : 1);
    for(let i = 0; i < this.notFoundHandlers.length; i++) {
        if(pathname.indexOf(this.notFoundHandlers[i].path) === 0) {
            return this.notFoundHandlers[i].notFoundHandler();
        }
    }
};

Router.prototype.listen = function() {
    this.history = createHistory();

    this.history.listen(location => {
        this.parseRoute(location.pathname);
    });
};

Router.prototype.redirect = function(path) {
    return this.history.push({
        pathname: path
    });
};

const consecutiveSlashes = /\/+/g;
const leadingSlash = /^([^\/])/;
const trailingSlash = /(.+)\/$/;
Router.normalizePath = path => path
    .replace(consecutiveSlashes, '/') // Ensure no consecutive slashes
    .replace(leadingSlash, '/$1') // Ensure leading slash
    .replace(trailingSlash, '$1'); // Ensure no trailing slash

Router.flattenRouteHash = (hash, notFoundHandlers) => {
    const flattened = {};

    const hooks = { before: [], after: [] };
    const renderers = [];

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
            else if(route === 'before' || route === 'after') {
                hooks[route][hooks[route].length] = { path: Router.normalizePath(prefix), hookFunction: item[route] };
            }

            // Renderer
            else if(route === 'render') {
                renderers[renderers.length] = { path: Router.normalizePath(prefix), renderFunction: item[route] };
            }

            // not found handlers
            else if(route === 'notFound' && notFoundHandlers) {
                notFoundHandlers[notFoundHandlers.length] = { path: Router.normalizePath(prefix), notFoundHandler: item[route] };
            }
        }
    };

    recursive(hash, '');

    applyBefore(flattened, hooks.before);
    applyAfter(flattened, hooks.after);
    applyRenderers(flattened, renderers);

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

const applyAfter = (flattened, hooks) => {
    hooks.sort((a, b) => a.path.length < b.path.length ? -1 : 1);

    for(let route in flattened) {
        for(let i = 0; i < hooks.length; i++) {
            if(route.indexOf(hooks[i].path) === 0) {
                if(!flattened[route].after) {
                    flattened[route].after = [];
                }

                flattened[route].after[flattened[route].after.length] = hooks[i].hookFunction;
            }
        }
    }
};

const applyRenderers = (flattened, renderers) => {
    renderers.sort((a, b) => a.path.length > b.path.length ? -1 : 1);

    for(let route in flattened) {
        for(let i = 0; i < renderers.length; i++) {
            if(route.indexOf(renderers[i].path) === 0) {
                if(!flattened[route].render) {
                    flattened[route].render = [];
                }

                flattened[route].render[flattened[route].render.length] = renderers[i].renderFunction;
            }
        }
    }
};

module.exports = Router;

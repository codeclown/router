'use strict';

const Promise = require('bluebird');
const test = require('tape');
const Router = require('../lib/router');

const handlers = {};
for(let i = 97; i <= 107; i++) {
    const char = String.fromCharCode(i);
    handlers[char] = () => char;
}

test('normalizePath', t => {
    t.ok(Router.normalizePath, 'should exist');
    t.equal(Router.normalizePath('/'), '/');
    t.equal(Router.normalizePath('/foobar'), '/foobar');
    t.equal(Router.normalizePath('/foo/bar'), '/foo/bar');
    t.equal(Router.normalizePath('//'), '/');
    t.equal(Router.normalizePath('//foobar'), '/foobar');
    t.equal(Router.normalizePath('/foo//bar'), '/foo/bar');
    t.equal(Router.normalizePath('//foo//bar'), '/foo/bar');
    t.equal(Router.normalizePath('/foobar/'), '/foobar');
    t.equal(Router.normalizePath('/foo/bar/'), '/foo/bar');
    t.equal(Router.normalizePath('foobar'), '/foobar');
    t.end();
});

test('flattenRouteHash', t => {
    t.ok(Router.flattenRouteHash, 'should exist');

    t.deepEqual(Router.flattenRouteHash({
        '/': handlers.a
    }), {
        '/': { handler: handlers.a }
    }, 'should support handlers');

    t.deepEqual(Router.flattenRouteHash({
        '/': handlers.a,
        '/foobar': handlers.a
    }), {
        '/': { handler: handlers.a },
        '/foobar': { handler: handlers.a }
    }, 'should support equal handlers');

    t.deepEqual(Router.flattenRouteHash({
        '/': handlers.a,
        '/foobar': handlers.b
    }), {
        '/': { handler: handlers.a },
        '/foobar': { handler: handlers.b }
    }, 'should support several handlers');

    t.deepEqual(Router.flattenRouteHash({
        '/': handlers.a,
        '/foo': {
            '/bar': handlers.b,
            '/baz': handlers.c,
            '/deep': {
                '/': handlers.d,
                '/when-will-this-end': handlers.e
            }
        }
    }), {
        '/': { handler: handlers.a },
        '/foo/bar': { handler: handlers.b },
        '/foo/baz': { handler: handlers.c },
        '/foo/deep': { handler: handlers.d },
        '/foo/deep/when-will-this-end': { handler: handlers.e }
    }, 'should support nested handlers');

    t.deepEqual(Router.flattenRouteHash({
        '/': {
            '/': handlers.a,
            before: handlers.b,
            after: handlers.c
        }
    }), {
        '/': { handler: handlers.a, before: [handlers.b], after: [handlers.c] }
    }, 'should pass hooks');

    t.deepEqual(Router.flattenRouteHash({
        '/': {
            before: handlers.b,
            '/': handlers.a
        }
    }), {
        '/': { handler: handlers.a, before: [handlers.b] }
    }, 'should pass hooks (order irrevelant)');

    t.deepEqual(Router.flattenRouteHash({
        '/': {
            before: handlers.a,
            '/': handlers.b,
            '/foobar': handlers.c
        }
    }), {
        '/': { handler: handlers.b, before: [handlers.a] },
        '/foobar': { handler: handlers.c, before: [handlers.a] }
    }, 'should inherit hooks');

    t.deepEqual(Router.flattenRouteHash({
        '/': {
            before: handlers.a,
            '/': handlers.b,
            '/foo': {
                '/bar': handlers.d,
                '/baz': {
                    before: handlers.e,
                    '/': handlers.f
                }
            }
        }
    }), {
        '/': { handler: handlers.b, before: [handlers.a] },
        '/foo/bar': { handler: handlers.d, before: [handlers.a] },
        '/foo/baz': { handler: handlers.f, before: [handlers.a, handlers.e] }
    }, 'should inherit multiple hooks');

    t.end();
});

test('should handle routes', t => {
    const router = new Router();

    const requests = [];

    router.setRoutes({
        '/': () => requests[requests.length] = 'home',
        '/foo': () => requests[requests.length] = 'foo',
        '/foobar': {
            '/': () => requests[requests.length] = 'foobar',
            '/:name': params => requests[requests.length] = `foobar/${params.name}`
        }
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/'))
        .then(() => router.parseRoute('/foo'))
        .then(() => router.parseRoute('/foobar'))
        .then(() => router.parseRoute('/foobar/phil'))
        .then(() => {
            t.deepEqual(requests, ['home', 'foo', 'foobar', 'foobar/phil']);
            t.end();
        });
});

test('should handle hooks', t => {
    const router = new Router();

    const requests = [];

    router.setRoutes({
        before: () => requests[requests.length] = 'before all',
        '/': () => requests[requests.length] = 'home',
        '/foo': () => requests[requests.length] = 'foo',
        '/:name': {
            before: params => requests[requests.length] = `before ${params.name}`,
            '/': params => requests[requests.length] = `${params.name}`,
            '/x': params => requests[requests.length] = `${params.name}/x`
        }
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/'))
        .then(() => router.parseRoute('/foo'))
        .then(() => router.parseRoute('/phil'))
        .then(() => router.parseRoute('/phil/x'))
        .then(() => {
            t.deepEqual(requests, [
                'before all', 'home',
                'before all', 'foo',
                'before all', 'before phil', 'phil',
                'before all', 'before phil', 'phil/x'
            ]);
            t.end();
        });
});

test('should handle hooks (Promises)', t => {
    const router = new Router();

    const requests = [];

    router.setRoutes({
        before: () => Promise.delay(200).then(() => requests[requests.length] = 'before'),
        '/:name': {
            '/': params => requests[requests.length] = params.name,
            '/foo': {
                before: () => Promise.delay(200).then(() => requests[requests.length] = 'before foo'),
                '/': params => requests[requests.length] = `${params.name}/foo`,
            }
        }
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/phil'))
        .then(() => router.parseRoute('/phil/foo'))
        .then(() => {
            t.deepEqual(requests, [
                'before', 'phil',
                'before', 'before foo', 'phil/foo'
            ]);
            t.end();
        });
});

test('should run render after handler', t => {
    const router = new Router();

    const object = {};

    router.setRoutes({
        '/:name': params => {
            object.name = params.name.toUpperCase();
            return object;
        },
        render: returnedObject => {
            t.ok(object === returnedObject, 'should alter same object');
            returnedObject.rendered = true;
        }
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/phil'))
        .then(() => {
            t.deepEqual(object, {
                name: 'PHIL',
                rendered: true
            });
            t.end();
        });
});

test('should support nested renderers', t => {
    const router = new Router();

    const object = {};

    router.setRoutes({
        '/:name': {
            '/': params => {
                object.name = params.name.toUpperCase();
                return object;
            },
            render: returnedObject => {
                t.ok(object === returnedObject, 'should alter same object');
                returnedObject.renderedAtName = true;
                return returnedObject;
            }
        },
        render: returnedObject => {
            t.ok(object === returnedObject, 'should alter same object');
            returnedObject.renderedAtRoot = true;
        }
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/phil'))
        .then(() => {
            t.deepEqual(object, {
                name: 'PHIL',
                renderedAtName: true,
                renderedAtRoot: true
            });
            t.end();
        });
});

test('should run notFound when route is not found', t => {
    const router = new Router();

    const handlers = [];

    router.setRoutes({
        notFound: () => handlers[handlers.length] = '404',
        '/bugs': () => handlers[handlers.length] = 'found'
    });

    return Promise.resolve()
        .then(() => router.parseRoute('/dreams'))
        .then(() => router.parseRoute('/bugs'))
        .then(() => router.parseRoute('/'))
        .then(() => {
            t.deepEqual(handlers, ['404', 'found', '404']);
            t.end();
        });
});

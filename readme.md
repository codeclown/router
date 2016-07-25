# The Router

Promise-powered routing independent of view framework.

**Not ready for production!** This library is only a concept at this point and is not ready for serious use.


## Usage

Illustrative example:

```
const router = new Router();

router.setRoutes({
    '/': HomeView,
    '/person/:id': {
        '/': PersonView,
        '/edit': EditPersonView
    },
    render: renderApp
});

router.listen();

function renderApp(view) {
    // view is now HomeView, PersonView or EditPersonView
    viewEngine.render(view);
}
```

Attach hooks to run before and after routes. Promises are supported.

```
const ensurePersonIsLoaded = params => getPerson(params.id)
    .then(person => state.dispatch('person_loaded', person));

router.setRoutes({
    '/': HomeView,
    '/person/:id': {
        before: ensurePersonIsLoaded,
        '/': PersonView,
        '/edit': EditPersonView
    }
});
```

Nested views:

```
router.setRoutes({
    '/': HomeView,
    '/person/:id': {
        '/': PersonView,
        render: renderPerson
    },
    render: renderApp
});

function PersonView(params) {
    return 'Text about person';
}

function renderPerson(view) {
    return m('.person-container', view);
}

function renderApp(view) {
    return m('.app-container', view);
}

// Visiting /person/123 would yield something like this:
// m('.app-container', m('.person-container', 'Text about person'))
```

See [examples/mithril.html](examples/mithril.html) for a working, more elaborate example.


## Credits

Powered by [route-parser](https://github.com/rcs/route-parser) and [history](https://github.com/mjackson/history).


## License

MIT

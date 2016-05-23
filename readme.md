# The Router

Promise-powered routing independent of view framework.

**Not ready for production!** This library is only a concept at this point and is not ready for serious use.


## Usage

Illustrative example:

```
const router = new Router();

const ensurePersonIsLoaded = params => {
    return getPerson(params.name)
        .then(person => state.person = person);
};

router.setRoutes({
    '/': HomeView,
    '/person/:name': {
        before: ensurePersonIsLoaded,
        '/': params => PersonView,
        '/edit': params => EditPersonView
    }
});

router.setAfterParse(view => {
    viewEngine.render(view);
});

router.listen();
```

In this example `viewEngine` receives a view from the route handlers. Route handlers are only ran after any `before`-hooks have been ran.

See [examples/basic.html](#) for a more elaborate version.


## Credits

Powered by [route-parser](https://github.com/rcs/route-parser) and [history](https://github.com/mjackson/history).


## License

MIT
